import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisService } from '../redis/redis.service';
import { Paquete } from './paquete.entity';
import { ListadoPaquetes, PaquetesService } from './paquetes.service';

describe('PaquetesService', () => {
  let service: PaquetesService;

  // Datos típicos de entrada. El destino lleva espacios a propósito
  // para comprobar que el servicio los limpia al guardar.
  const datos = {
    destino: ' Cancún ',
    fechaInicio: '2026-12-15',
    fechaFin: '2026-12-20',
    precio: '1500.00',
    cupoTotal: 10,
  };

  // Simula el query builder encadenado de TypeORM.
  const consulta = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn<() => Promise<[Paquete[], number]>>(),
  };

  // Repositorio falso con las operaciones que usa PaquetesService.
  const repositorio = {
    create: jest.fn<(valor: unknown) => unknown>(),
    save: jest.fn<(valor: unknown) => Promise<unknown>>(),
    findOne: jest.fn<(opciones: unknown) => Promise<Paquete | null>>(),
    findOneBy: jest.fn<(opciones: unknown) => Promise<Paquete | null>>(),
    update:
      jest.fn<
        (id: string, cambios: unknown) => Promise<{ affected: number }>
      >(),
    createQueryBuilder: jest.fn().mockReturnValue(consulta),
  };

  const manager = {
    getRepository: jest.fn().mockReturnValue(repositorio),
  };

  // Ejecuta la operación de la transacción con el manager falso.
  const transaction =
    jest.fn<
      (
        operacion: (valor: typeof manager) => Promise<unknown>,
      ) => Promise<unknown>
    >();

  // Capa de caché falsa: versión, lectura, escritura e invalidación.
  const redis = {
    invalidarPaquetes: jest.fn<() => Promise<void>>(),
    obtenerVersionPaquetes: jest.fn<() => Promise<string | null>>(),
    obtenerJson: jest.fn<(clave: string) => Promise<ListadoPaquetes | null>>(),
    guardarJson:
      jest.fn<
        (clave: string, valor: unknown, segundos: number) => Promise<void>
      >(),
  };

  function paqueteDePrueba(): Paquete {
    // 10 cupos totales y 7 disponibles => 3 ya ocupados.
    return Object.assign(new Paquete(), {
      id: 'paquete-1',
      destino: 'Cancún',
      fechaInicio: '2026-12-15',
      fechaFin: '2026-12-20',
      precio: '1500.00',
      cupoTotal: 10,
      cupoDisponible: 7,
      activo: true,
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    // create/save devuelven lo mismo que reciben.
    repositorio.create.mockImplementation((valor: unknown) => valor);
    repositorio.save.mockImplementation((valor: unknown) =>
      Promise.resolve(valor),
    );

    repositorio.findOne.mockResolvedValue(paqueteDePrueba());
    repositorio.findOneBy.mockResolvedValue(paqueteDePrueba());
    repositorio.update.mockResolvedValue({ affected: 1 });

    consulta.getManyAndCount.mockResolvedValue([[paqueteDePrueba()], 1]);

    transaction.mockImplementation(
      (operacion: (valor: typeof manager) => Promise<unknown>) =>
        operacion(manager),
    );

    // Por defecto Redis responde, pero sin listado en caché.
    redis.invalidarPaquetes.mockResolvedValue(undefined);
    redis.obtenerVersionPaquetes.mockResolvedValue('version-1');
    redis.obtenerJson.mockResolvedValue(null);
    redis.guardarJson.mockResolvedValue(undefined);

    // Monta el servicio con repositorio y Redis falsos.
    const modulo = await Test.createTestingModule({
      providers: [
        PaquetesService,
        {
          provide: getRepositoryToken(Paquete),
          useValue: {
            ...repositorio,
            manager: { transaction },
          },
        },
        {
          provide: RedisService,
          useValue: redis,
        },
      ],
    }).compile();

    service = modulo.get(PaquetesService);
  });

  it('crea el paquete con todo el cupo disponible e invalida caché', async () => {
    const resultado = await service.crear(datos);

    // Al crear, cupoDisponible empieza igual al cupoTotal.
    // También se limpia el destino (" Cancún " -> "Cancún").
    expect(resultado).toMatchObject({
      destino: 'Cancún',
      cupoTotal: 10,
      cupoDisponible: 10,
    });

    expect(repositorio.save).toHaveBeenCalledTimes(1);
    // Cualquier cambio de paquetes debe limpiar la caché.
    expect(redis.invalidarPaquetes).toHaveBeenCalledTimes(1);
  });

  it('rechaza la creación con fechas invertidas', async () => {
    // fechaFin anterior a fechaInicio no es válida.
    await expect(
      service.crear({
        ...datos,
        fechaFin: '2026-12-01',
      }),
    ).rejects.toThrow(BadRequestException);

    // Si la validación falla, no se escribe nada en BD ni en caché.
    expect(repositorio.save).not.toHaveBeenCalled();
    expect(redis.invalidarPaquetes).not.toHaveBeenCalled();
  });

  it('devuelve la caché sin consultar PostgreSQL', async () => {
    const cache: ListadoPaquetes = {
      items: [paqueteDePrueba()],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    // Simula un hit de caché.
    redis.obtenerJson.mockResolvedValue(cache);

    const resultado = await service.listar({
      page: 1,
      limit: 10,
    });

    // Con caché caliente se evita ir a la base de datos.
    expect(resultado).toEqual(cache);
    expect(repositorio.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('aplica filtros y paginación y guarda el resultado en caché', async () => {
    // 11 resultados con limit 10 => 2 páginas.
    consulta.getManyAndCount.mockResolvedValue([[paqueteDePrueba()], 11]);

    const resultado = await service.listar({
      destino: ' Cancún ',
      fechaDesde: '2026-12-01',
      fechaHasta: '2026-12-31',
      precioMax: '2000.00',
      page: 2,
      limit: 10,
    });

    // Solo se listan paquetes activos.
    expect(consulta.where).toHaveBeenCalledWith('paquete.activo = :activo', {
      activo: true,
    });

    // El destino se busca con ILIKE y comodines.
    expect(consulta.andWhere).toHaveBeenCalledWith(
      'paquete.destino ILIKE :destino',
      { destino: '%Cancún%' },
    );

    expect(consulta.andWhere).toHaveBeenCalledWith(
      'paquete.fechaInicio >= :fechaDesde',
      { fechaDesde: '2026-12-01' },
    );

    expect(consulta.andWhere).toHaveBeenCalledWith(
      'paquete.fechaFin <= :fechaHasta',
      { fechaHasta: '2026-12-31' },
    );

    expect(consulta.andWhere).toHaveBeenCalledWith(
      'paquete.precio <= :precioMax',
      { precioMax: '2000.00' },
    );

    // Página 2 con limit 10 => se saltan los primeros 10.
    expect(consulta.skip).toHaveBeenCalledWith(10);
    expect(consulta.take).toHaveBeenCalledWith(10);
    expect(resultado.totalPages).toBe(2);

    // El resultado se guarda 60 segundos en Redis.
    expect(redis.guardarJson).toHaveBeenCalledWith(
      expect.any(String),
      resultado,
      60,
    );
  });

  it('consulta PostgreSQL cuando Redis no está disponible', async () => {
    // Sin versión de caché, Redis se considera caído o vacío.
    redis.obtenerVersionPaquetes.mockResolvedValue(null);

    const resultado = await service.listar({
      page: 1,
      limit: 10,
    });

    expect(resultado.total).toBe(1);
    expect(consulta.getManyAndCount).toHaveBeenCalledTimes(1);
    // No intentamos leer ni escribir caché en ese caso.
    expect(redis.obtenerJson).not.toHaveBeenCalled();
    expect(redis.guardarJson).not.toHaveBeenCalled();
  });

  it('rechaza filtros con fechas invertidas', async () => {
    // Misma regla que al crear: fechaDesde no puede ir después de fechaHasta.
    await expect(
      service.listar({
        fechaDesde: '2026-12-20',
        fechaHasta: '2026-12-01',
        page: 1,
        limit: 10,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(repositorio.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('reporta un paquete inexistente', async () => {
    repositorio.findOneBy.mockResolvedValue(null);

    await expect(service.buscarPorId('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('conserva los lugares ocupados al aumentar el cupo total', async () => {
    // Había 3 ocupados (10 - 7). Al subir a 15, disponibles pasan a 12.
    const resultado = await service.actualizar('paquete-1', {
      cupoTotal: 15,
    });

    expect(resultado).toMatchObject({
      cupoTotal: 15,
      cupoDisponible: 12,
    });

    // La actualización usa bloqueo pesimista dentro de la transacción.
    expect(repositorio.findOne).toHaveBeenCalledWith({
      where: { id: 'paquete-1', activo: true },
      lock: { mode: 'pessimistic_write' },
    });

    expect(redis.invalidarPaquetes).toHaveBeenCalledTimes(1);
  });

  it('impide reducir el cupo por debajo de los lugares ocupados', async () => {
    // Hay 3 ocupados; bajar el total a 2 dejaría el cupo inconsistente.
    await expect(
      service.actualizar('paquete-1', {
        cupoTotal: 2,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(repositorio.save).not.toHaveBeenCalled();
    expect(redis.invalidarPaquetes).not.toHaveBeenCalled();
  });

  it('rechaza una actualización vacía', async () => {
    // Sin campos que cambiar no tiene sentido abrir una transacción.
    await expect(service.actualizar('paquete-1', {})).rejects.toThrow(
      BadRequestException,
    );

    expect(transaction).not.toHaveBeenCalled();
  });

  it('desactiva el paquete e invalida caché', async () => {
    // Soft delete: marca activo=false en lugar de borrar la fila.
    await service.desactivar('paquete-1');

    expect(repositorio.update).toHaveBeenCalledWith('paquete-1', {
      activo: false,
    });

    expect(redis.invalidarPaquetes).toHaveBeenCalledTimes(1);
  });

  it('reporta un paquete inexistente al desactivar', async () => {
    // affected 0 significa que no había fila que actualizar.
    repositorio.update.mockResolvedValue({ affected: 0 });

    await expect(service.desactivar('inexistente')).rejects.toThrow(
      NotFoundException,
    );

    expect(redis.invalidarPaquetes).not.toHaveBeenCalled();
  });
});
