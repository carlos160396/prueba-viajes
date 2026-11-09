import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Decimal } from 'decimal.js';
import { Repository } from 'typeorm';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado';
import { Paquete } from '../paquetes/paquete.entity';
import { RolUsuario, Usuario } from '../usuarios/usuario.entity';
import { CrearReservacionDto } from './dto/crear-reservacion.dto';
import { EstadoPago, Reservacion } from './reservacion.entity';
import { ListarReservacionesDto } from './dto/listar-reservaciones.dto';
import { RedisService } from 'src/redis/redis.service';

const Dinero = Decimal.clone({ precision: 30 });

@Injectable()
export class ReservacionesService {
  constructor(
    @InjectRepository(Reservacion)
    private readonly reservacionesRepository: Repository<Reservacion>,
    private readonly redisService: RedisService,
  ) {}

  async crear(
    datos: CrearReservacionDto,
    usuario: UsuarioAutenticado,
  ): Promise<Reservacion> {
    let clienteId: string;

    if (usuario.rol === RolUsuario.CLIENTE) {
      if (datos.clienteId !== undefined && datos.clienteId !== usuario.id) {
        throw new ForbiddenException('Solo puedes crear reservaciones propias');
      }

      clienteId = usuario.id;
    } else if (usuario.rol === RolUsuario.AGENTE) {
      if (!datos.clienteId) {
        throw new BadRequestException(
          'Debes indicar el cliente de la reservación',
        );
      }

      clienteId = datos.clienteId;
    } else {
      throw new ForbiddenException(
        'No tienes permiso para crear reservaciones',
      );
    }

    const resultado = await this.reservacionesRepository.manager.transaction(
      async (manager) => {
        const cliente = await manager.getRepository(Usuario).findOneBy({
          id: clienteId,
          rol: RolUsuario.CLIENTE,
        });

        if (!cliente) {
          throw new NotFoundException('Cliente no encontrado');
        }

        const paquetesRepository = manager.getRepository(Paquete);

        const paquete = await paquetesRepository.findOne({
          where: { id: datos.paqueteId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!paquete || !paquete.activo) {
          throw new NotFoundException('Paquete no disponible');
        }

        if (paquete.cupoDisponible < datos.numeroPersonas) {
          throw new ConflictException('No hay cupo suficiente');
        }

        const total = new Dinero(paquete.precio)
          .mul(datos.numeroPersonas)
          .toFixed(2);

        const repositorio = manager.getRepository(Reservacion);

        const reservacion = repositorio.create({
          clienteId,
          creadaPorId: usuario.id,
          paqueteId: paquete.id,
          numeroPersonas: datos.numeroPersonas,
          precioUnitario: paquete.precio,
          total,
          estadoPago: EstadoPago.PENDIENTE,
        });

        paquete.cupoDisponible -= datos.numeroPersonas;

        await paquetesRepository.save(paquete);

        return repositorio.save(reservacion);
      },
    );

    await this.redisService.invalidarPaquetes();

    return resultado;
  }

  async listar(filtros: ListarReservacionesDto, usuario: UsuarioAutenticado) {
    const { page, limit } = filtros;

    const [items, total] = await this.reservacionesRepository.findAndCount({
      where:
        usuario.rol === RolUsuario.CLIENTE ? { clienteId: usuario.id } : {},
      relations: {
        paquete: true,
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async buscarPorId(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<Reservacion> {
    const reservacion = await this.reservacionesRepository.findOne({
      where: { id },
      relations: {
        paquete: true,
      },
    });

    if (!reservacion) {
      throw new NotFoundException('Reservación no encontrada');
    }

    if (
      usuario.rol === RolUsuario.CLIENTE &&
      reservacion.clienteId !== usuario.id
    ) {
      throw new ForbiddenException(
        'No tienes permiso para consultar esta reservación',
      );
    }

    return reservacion;
  }

  async cambiarEstado(
    id: string,
    nuevoEstado: EstadoPago,
    usuario: UsuarioAutenticado,
  ): Promise<Reservacion> {
    if (usuario.rol !== RolUsuario.AGENTE) {
      throw new ForbiddenException(
        'Solo los agentes pueden cambiar el estado de pago',
      );
    }

    const resultado = await this.reservacionesRepository.manager.transaction(
      async (manager) => {
        const repositorio = manager.getRepository(Reservacion);

        const reservacion = await repositorio.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!reservacion) {
          throw new NotFoundException('Reservación no encontrada');
        }

        if (reservacion.estadoPago === nuevoEstado) {
          return reservacion;
        }

        if (reservacion.estadoPago === EstadoPago.CANCELADA) {
          throw new ConflictException(
            'Una reservación cancelada no puede reactivarse',
          );
        }

        if (nuevoEstado === EstadoPago.PENDIENTE) {
          throw new ConflictException(
            'La reservación no puede regresar a pendiente',
          );
        }

        if (nuevoEstado === EstadoPago.CANCELADA) {
          const paquetesRepository = manager.getRepository(Paquete);

          const paquete = await paquetesRepository.findOne({
            where: { id: reservacion.paqueteId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!paquete) {
            throw new NotFoundException('Paquete no encontrado');
          }

          const nuevoCupo = paquete.cupoDisponible + reservacion.numeroPersonas;

          if (nuevoCupo > paquete.cupoTotal) {
            throw new ConflictException('El cupo del paquete es inconsistente');
          }

          paquete.cupoDisponible = nuevoCupo;

          await paquetesRepository.save(paquete);
        }

        reservacion.estadoPago = nuevoEstado;

        return repositorio.save(reservacion);
      },
    );

    await this.redisService.invalidarPaquetes();

    return resultado;
  }
}
