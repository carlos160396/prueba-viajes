import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port: Number(config.getOrThrow<string>('REDIS_PORT')),
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 1000,
      commandTimeout: 1000,
      maxRetriesPerRequest: 1,
      retryStrategy: (intento) => Math.min(intento * 500, 3000),
    });

    this.client.on('ready', () => {
      this.logger.log('Redis conectado');
    });

    this.client.on('error', () => {
      this.logger.warn('Redis no disponible');
    });
  }

  onModuleInit(): void {
    void this.client.connect().catch(() => {
      this.logger.warn('No se pudo establecer la conexión inicial con Redis');
    });
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async obtenerVersionPaquetes(): Promise<string | null> {
    if (this.client.status !== 'ready') {
      return null;
    }

    try {
      const clave = 'paquetes:version';

      await this.client.set(clave, randomUUID(), 'NX');

      return await this.client.get(clave);
    } catch {
      return null;
    }
  }

  async obtenerJson<T>(clave: string): Promise<T | null> {
    if (this.client.status !== 'ready') {
      return null;
    }

    try {
      const contenido = await this.client.get(clave);

      return contenido === null ? null : (JSON.parse(contenido) as T);
    } catch {
      return null;
    }
  }

  async guardarJson(
    clave: string,
    valor: unknown,
    segundos: number,
  ): Promise<void> {
    if (this.client.status !== 'ready') {
      return;
    }

    try {
      await this.client.set(clave, JSON.stringify(valor), 'EX', segundos);
    } catch {
      this.logger.warn('No se pudo guardar la caché');
    }
  }

  async invalidarPaquetes(): Promise<void> {
    if (this.client.status !== 'ready') {
      this.logger.warn('No se pudo invalidar la caché de paquetes');
      return;
    }

    try {
      await this.client.set('paquetes:version', randomUUID());
    } catch {
      this.logger.warn('No se pudo invalidar la caché de paquetes');
    }
  }
}
