import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Paquete } from '../paquetes/paquete.entity';
import { RolUsuario, Usuario } from '../usuarios/usuario.entity';
import { RedisService } from '../redis/redis.service';
import { MensajeriaService } from '../mensajeria/mensajeria.service';
import { EstadoPago, Reservacion } from './reservacion.entity';
import { ReservacionesService } from './reservaciones.service';

describe('ReservacionesService', () => {
  let service: ReservacionesService;

  // Usuario autenticado por defecto en la mayoría de las pruebas.
  const cliente = {
    id: 'cliente-1',
    rol: RolUsuario.CLIENTE,
  };

  // Repositorios falsos que usa la transacción según la entidad.
  const usuarios = {
    findOneBy:
      jest.fn<(opciones: unknown) => Promise<Partial<Usuario> | null>>(),
  };

  const paquetes = {
    findOne: jest.fn<(opciones: unknown) => Promise<Partial<Paquete> | null>>(),
    save: jest.fn<(valor: unknown) => Promise<unknown>>(),
  };

  const reservaciones = {
    findOne:
      jest.fn<(opciones: unknown) => Promise<Partial<Reservacion> | null>>(),
    findAndCount:
      jest.fn<
        (opciones: unknown) => Promise<[Array<Partial<Reservacion>>, number]>
      >(),
    create: jest.fn<(valor: unknown) => unknown>(),
    save: jest.fn<(valor: object) => Promise<object>>(),
  };

  const manager = {
    getRepository: jest.fn<(entidad: unknown) => unknown>(),
  };

  // Simula manager.transaction: ejecuta el callback con el manager falso.
  const transaction =
    jest.fn<
      (
        operacion: (valor: typeof manager) => Promise<unknown>,
      ) => Promise<unknown>
    >();

  // Tras crear o cancelar, se limpia la caché de paquetes.
  const redis = {
    invalidarPaquetes: jest.fn<() => Promise<void>>(),
  };

  // Publica el evento de "reserva creada" hacia el worker.
  const mensajeria = {
    publicarReservaCreada:
      jest.fn<
        (evento: { eventoId: string; reservacionId: string }) => Promise<void>
      >(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    usuarios.findOneBy.mockResolvedValue(cliente);

    // Paquete activo con cupo suficiente para reservar.
    paquetes.findOne.mockResolvedValue({
      id: 'paquete-1',
      activo: true,
      precio: '1500.10',
      cupoTotal: 10,
      cupoDisponible: 10,
    });

    paquetes.save.mockImplementation((valor: unknown) =>
      Promise.resolve(valor),
    );

    reservaciones.create.mockImplementation((valor: unknown) => valor);

    // Al guardar, devolvemos lo mismo más un id fijo.
    reservaciones.save.mockImplementation((valor: object) =>
      Promise.resolve({
        ...valor,
        id: 'reserva-1',
      }),
    );

    // Dentro de la transacción, cada entidad apunta a su mock.
    manager.getRepository.mockImplementation((entidad: unknown) => {
      if (entidad === Usuario) {
        return usuarios;
      }

      if (entidad === Paquete) {
        return paquetes;
      }

      if (entidad === Reservacion) {
        return reservaciones;
      }

      throw new Error('Repositorio no configurado');
    });

    transaction.mockImplementation(
      (operacion: (valor: typeof manager) => Promise<unknown>) =>
        operacion(manager),
    );

    redis.invalidarPaquetes.mockResolvedValue(undefined);
    mensajeria.publicarReservaCreada.mockResolvedValue(undefined);

    // Monta el servicio con dependencias falsas.
    const modulo = await Test.createTestingModule({
      providers: [
        ReservacionesService,
        {
          provide: getRepositoryToken(Reservacion),
          useValue: {
            // Las consultas usan el repositorio directamente;
            // crear y cancelar usan los repositorios de la transacción.
            ...reservaciones,
            manager: { transaction },
          },
        },
        {
          provide: RedisService,
          useValue: redis,
        },
        {
          provide: MensajeriaService,
          useValue: mensajeria,
        },
      ],
    }).compile();

    service = modulo.get(ReservacionesService);
  });

  it('calcula el total, descuenta cupo y publica el evento', async () => {
    const resultado = await service.crear(
      {
        paqueteId: 'paquete-1',
        numeroPersonas: 3,
      },
      cliente,
    );

    // 1500.10 × 3 = 4500.30; el pago queda pendiente al crear.
    expect(resultado).toMatchObject({
      id: 'reserva-1',
      clienteId: cliente.id,
      creadaPorId: cliente.id,
      precioUnitario: '1500.10',
      total: '4500.30',
      estadoPago: EstadoPago.PENDIENTE,
    });

    // 10 cupos - 3 personas = 7 disponibles.
    expect(paquetes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cupoDisponible: 7,
      }),
    );

    // El bloqueo pesimista evita que dos reservas peleen por el mismo cupo.
    expect(paquetes.findOne).toHaveBeenCalledWith({
      where: { id: 'paquete-1' },
      lock: { mode: 'pessimistic_write' },
    });

    expect(redis.invalidarPaquetes).toHaveBeenCalledTimes(1);

    expect(mensajeria.publicarReservaCreada).toHaveBeenCalledWith({
      eventoId: expect.any(String),
      reservacionId: 'reserva-1',
    });
  });

  it('rechaza la reserva si no hay cupo suficiente', async () => {
    // Solo hay 2 plazas y se piden 3.
    paquetes.findOne.mockResolvedValue({
      id: 'paquete-1',
      activo: true,
      precio: '1500.10',
      cupoTotal: 10,
      cupoDisponible: 2,
    });

    await expect(
      service.crear(
        {
          paqueteId: 'paquete-1',
          numeroPersonas: 3,
        },
        cliente,
      ),
    ).rejects.toThrow(ConflictException);

    // Si falla por cupo, no debe persistir ni notificar nada.
    expect(paquetes.save).not.toHaveBeenCalled();
    expect(reservaciones.save).not.toHaveBeenCalled();
    expect(redis.invalidarPaquetes).not.toHaveBeenCalled();
    expect(mensajeria.publicarReservaCreada).not.toHaveBeenCalled();
  });

  it('devuelve el cupo una sola vez al cancelar repetidamente', async () => {
    const reservacion = {
      id: 'reserva-1',
      paqueteId: 'paquete-1',
      numeroPersonas: 3,
      estadoPago: EstadoPago.PENDIENTE,
    };

    reservaciones.findOne.mockResolvedValue(reservacion);

    paquetes.findOne.mockResolvedValue({
      id: 'paquete-1',
      activo: true,
      cupoTotal: 10,
      cupoDisponible: 7,
    });

    // Solo un agente puede cambiar el estado de pago.
    const agente = {
      id: 'agente-1',
      rol: RolUsuario.AGENTE,
    };

    const resultado = await service.cambiarEstado(
      'reserva-1',
      EstadoPago.CANCELADA,
      agente,
    );

    expect(resultado.estadoPago).toBe(EstadoPago.CANCELADA);

    // Al cancelar se liberan las 3 plazas: 7 + 3 = 10.
    expect(paquetes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cupoDisponible: 10,
      }),
    );

    // Segunda cancelación: el estado ya es CANCELADA, no vuelve a liberar cupo.
    await service.cambiarEstado('reserva-1', EstadoPago.CANCELADA, agente);

    expect(paquetes.save).toHaveBeenCalledTimes(1);
    expect(reservaciones.save).toHaveBeenCalledTimes(1);
    expect(mensajeria.publicarReservaCreada).not.toHaveBeenCalled();
  });

  it('impide que un cliente cambie el estado de pago', async () => {
    // Solo los agentes pueden marcar pagada o cancelada.
    await expect(
      service.cambiarEstado('reserva-1', EstadoPago.PAGADA, cliente),
    ).rejects.toThrow(ForbiddenException);

    expect(transaction).not.toHaveBeenCalled();
    expect(paquetes.save).not.toHaveBeenCalled();
    expect(reservaciones.save).not.toHaveBeenCalled();
  });

  it('filtra el listado para mostrar solo las reservas del cliente', async () => {
    const reserva = {
      id: 'reserva-1',
      clienteId: cliente.id,
    };

    reservaciones.findAndCount.mockResolvedValue([[reserva], 1]);

    const resultado = await service.listar({ page: 1, limit: 10 }, cliente);

    // El filtro debe salir del usuario autenticado, no del frontend.
    expect(reservaciones.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clienteId: cliente.id },
        skip: 0,
        take: 10,
      }),
    );

    expect(resultado).toMatchObject({
      items: [reserva],
      total: 1,
      totalPages: 1,
    });
  });

  it('permite al administrador listar todas las reservas', async () => {
    reservaciones.findAndCount.mockResolvedValue([[], 0]);

    await service.listar(
      { page: 1, limit: 10 },
      {
        id: 'admin-1',
        rol: RolUsuario.ADMIN,
      },
    );

    // Sin filtro de clienteId: ve el listado completo.
    expect(reservaciones.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('rechaza consultar una reserva de otro cliente', async () => {
    reservaciones.findOne.mockResolvedValue({
      id: 'reserva-ajena',
      clienteId: 'otro-cliente',
    });

    // Conocer el ID de una reserva no concede permiso para verla.
    await expect(service.buscarPorId('reserva-ajena', cliente)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('permite al cliente consultar su propia reserva', async () => {
    const reserva = {
      id: 'reserva-1',
      clienteId: cliente.id,
    };

    reservaciones.findOne.mockResolvedValue(reserva);

    const resultado = await service.buscarPorId('reserva-1', cliente);

    expect(resultado).toEqual(reserva);
  });

  it('impide que un cliente reserve para otra persona', async () => {
    // Un cliente no puede inventar el clienteId de alguien más.
    await expect(
      service.crear(
        {
          paqueteId: 'paquete-1',
          numeroPersonas: 1,
          clienteId: 'otro-cliente',
        },
        cliente,
      ),
    ).rejects.toThrow(ForbiddenException);

    // Se corta antes de abrir la transacción.
    expect(transaction).not.toHaveBeenCalled();
    expect(mensajeria.publicarReservaCreada).not.toHaveBeenCalled();
  });
});
