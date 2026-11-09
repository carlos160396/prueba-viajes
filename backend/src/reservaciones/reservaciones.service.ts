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

const Dinero = Decimal.clone({ precision: 30 });

@Injectable()
export class ReservacionesService {
  constructor(
    @InjectRepository(Reservacion)
    private readonly reservacionesRepository: Repository<Reservacion>,
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

    return this.reservacionesRepository.manager.transaction(async (manager) => {
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
    });
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
}
