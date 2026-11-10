import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { MensajeriaService } from '../mensajeria/mensajeria.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly mensajeriaService: MensajeriaService,
  ) {}

  private async comprobar(
    operacion: () => Promise<unknown>,
  ): Promise<'up' | 'down'> {
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        operacion(),
        new Promise<never>((_, reject) => {
          temporizador = setTimeout(
            () => reject(new Error('Tiempo de espera agotado')),
            2000,
          );
        }),
      ]);

      return 'up';
    } catch {
      return 'down';
    } finally {
      if (temporizador !== undefined) {
        clearTimeout(temporizador);
      }
    }
  }

  @Get()
  async verificar() {
    const [postgres, redis, rabbitmq] = await Promise.all([
      this.comprobar(() => this.dataSource.query('SELECT 1')),
      this.comprobar(async () => {
        const respuesta = await this.redisService.ping();

        if (respuesta !== 'PONG') {
          throw new Error('Redis no respondió correctamente');
        }
      }),
      this.comprobar(() => this.mensajeriaService.verificarConexion()),
    ]);

    const disponible = [postgres, redis, rabbitmq].every(
      (estado) => estado === 'up',
    );

    const resultado = {
      status: disponible ? 'ok' : 'error',
      servicios: {
        postgres,
        redis,
        rabbitmq,
      },
    };

    if (!disponible) {
      throw new ServiceUnavailableException(resultado);
    }

    return resultado;
  }
}
