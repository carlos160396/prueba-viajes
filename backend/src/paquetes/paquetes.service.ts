import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrearPaqueteDto } from './dto/crear-paquete.dto';
import { Paquete } from './paquete.entity';
import { ListarPaquetesDto } from './dto/listar-paquetes.dto';
import { ActualizarPaqueteDto } from './dto/actualizar-paquete.dto';
import { RedisService } from 'src/redis/redis.service';

export interface ListadoPaquetes {
  items: Paquete[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PaquetesService {
  constructor(
    @InjectRepository(Paquete)
    private readonly paquetesRepository: Repository<Paquete>,
    private readonly redisService: RedisService,
  ) {}

  async crear(datos: CrearPaqueteDto): Promise<Paquete> {
    if (datos.fechaFin < datos.fechaInicio) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la inicial',
      );
    }

    const paquete = this.paquetesRepository.create({
      destino: datos.destino.trim(),
      fechaInicio: datos.fechaInicio,
      fechaFin: datos.fechaFin,
      precio: datos.precio,
      cupoTotal: datos.cupoTotal,
      // Al crear, todo el cupo está libre.
      cupoDisponible: datos.cupoTotal,
    });

    const guardado = await this.paquetesRepository.save(paquete);

    // El listado en Redis queda desactualizado; se cambia la versión.
    await this.redisService.invalidarPaquetes();

    return guardado;
  }

  async listar(filtros: ListarPaquetesDto) {
    const { destino, fechaDesde, fechaHasta, precioMax, page, limit } = filtros;

    if (fechaDesde && fechaHasta && fechaHasta < fechaDesde) {
      throw new BadRequestException(
        'La fecha hasta no puede ser anterior a la fecha desde',
      );
    }

    // Si Redis no responde, version es null y se consulta solo PostgreSQL.
    const version = await this.redisService.obtenerVersionPaquetes();

    // La clave incluye filtros + página. Al invalidar, cambia `version`
    // y las claves viejas dejan de usarse (caducan solas a los 60s).
    const clave = version
      ? `paquetes:listado:${version}:${JSON.stringify({
          destino: destino?.trim() ?? '',
          fechaDesde: fechaDesde ?? '',
          fechaHasta: fechaHasta ?? '',
          precioMax: precioMax ?? '',
          page,
          limit,
        })}`
      : null;

    if (clave) {
      const cache = await this.redisService.obtenerJson<ListadoPaquetes>(clave);

      if (cache !== null) {
        return cache;
      }
    }

    const consulta = this.paquetesRepository
      .createQueryBuilder('paquete')
      .where('paquete.activo = :activo', { activo: true });

    if (destino?.trim()) {
      consulta.andWhere('paquete.destino ILIKE :destino', {
        destino: `%${destino.trim()}%`,
      });
    }

    if (fechaDesde) {
      consulta.andWhere('paquete.fechaInicio >= :fechaDesde', {
        fechaDesde,
      });
    }

    if (fechaHasta) {
      consulta.andWhere('paquete.fechaFin <= :fechaHasta', {
        fechaHasta,
      });
    }

    if (precioMax !== undefined) {
      consulta.andWhere('paquete.precio <= :precioMax', {
        precioMax,
      });
    }

    const [items, total] = await consulta
      .orderBy('paquete.fechaInicio', 'ASC')
      .addOrderBy('paquete.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const resultado = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    // Guarda 60 segundos. Si Redis falló, clave es null y se omite.
    if (clave) {
      await this.redisService.guardarJson(clave, resultado, 60);
    }

    return resultado;
  }

  async buscarPorId(id: string): Promise<Paquete> {
    const paquete = await this.paquetesRepository.findOneBy({
      id,
      activo: true,
    });

    if (!paquete) {
      throw new NotFoundException('Paquete no encontrado');
    }

    return paquete;
  }

  async actualizar(id: string, datos: ActualizarPaqueteDto): Promise<Paquete> {
    if (!Object.values(datos).some((valor) => valor !== undefined)) {
      throw new BadRequestException(
        'Debes enviar al menos un campo para actualizar',
      );
    }

    const resultado = await this.paquetesRepository.manager.transaction(
      async (manager) => {
        const repositorio = manager.getRepository(Paquete);

        // Bloqueo para que no se mezcle con una reserva al mismo tiempo.
        const paquete = await repositorio.findOne({
          where: { id, activo: true },
          lock: { mode: 'pessimistic_write' },
        });

        if (!paquete) {
          throw new NotFoundException('Paquete no encontrado');
        }

        const fechaInicio = datos.fechaInicio ?? paquete.fechaInicio;
        const fechaFin = datos.fechaFin ?? paquete.fechaFin;

        if (fechaFin < fechaInicio) {
          throw new BadRequestException(
            'La fecha final no puede ser anterior a la inicial',
          );
        }

        if (datos.cupoTotal !== undefined) {
          // Los lugares ya reservados se conservan al subir o bajar el total.
          const ocupados = paquete.cupoTotal - paquete.cupoDisponible;

          if (datos.cupoTotal < ocupados) {
            throw new BadRequestException(
              'El cupo total no puede ser menor que los lugares reservados',
            );
          }

          paquete.cupoTotal = datos.cupoTotal;
          paquete.cupoDisponible = datos.cupoTotal - ocupados;
        }

        if (datos.destino !== undefined) {
          paquete.destino = datos.destino.trim();
        }

        if (datos.precio !== undefined) {
          paquete.precio = datos.precio;
        }

        paquete.fechaInicio = fechaInicio;
        paquete.fechaFin = fechaFin;

        return repositorio.save(paquete);
      },
    );

    await this.redisService.invalidarPaquetes();

    return resultado;
  }

  async desactivar(id: string): Promise<void> {
    // No borra la fila; solo deja de listarse y reservarse.
    const resultado = await this.paquetesRepository.update(id, {
      activo: false,
    });

    if (resultado.affected === 0) {
      throw new NotFoundException('Paquete no encontrado');
    }

    await this.redisService.invalidarPaquetes();
  }
}
