import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

// Redis guarda el listado de paquetes para no ir a PostgreSQL en cada GET.
//
// Cómo funciona la invalidación (patrón "cache busting" por versión):
// 1. Existe una clave `paquetes:version` con un UUID.
// 2. Cada listado se guarda como `paquetes:listado:<version>:<filtros>`.
// 3. Al crear/editar/reservar, se cambia el UUID de `paquetes:version`.
// 4. Las claves viejas dejan de coincidir y caducan solas (EX 60 segundos).
//    Así no hay que borrar una por una.
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port: Number(config.getOrThrow<string>('REDIS_PORT')),
      // lazyConnect: no se conecta en el constructor; lo hace onModuleInit.
      lazyConnect: true,
      // Si Redis está caído, los comandos fallan al momento (no se encolan).
      enableOfflineQueue: false,
      connectTimeout: 1000,
      commandTimeout: 1000,
      maxRetriesPerRequest: 1,
      // Reintenta cada vez un poco más, máximo 3 segundos.
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
    // Si falla, la API sigue: listar paquetes irá directo a PostgreSQL.
    void this.client.connect().catch(() => {
      this.logger.warn('No se pudo establecer la conexión inicial con Redis');
    });
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }

  // Usado por /health. Redis responde "PONG" si está vivo.
  async ping(): Promise<string> {
    return this.client.ping();
  }

  // Devuelve la versión actual del listado, o null si Redis no está listo.
  async obtenerVersionPaquetes(): Promise<string | null> {
    if (this.client.status !== 'ready') {
      return null;
    }

    try {
      const clave = 'paquetes:version';

      // NX = "solo si no existe": la primera llamada crea la versión.
      // Las siguientes no la pisan; invalidarPaquetes es quien la cambia.
      await this.client.set(clave, randomUUID(), 'NX');

      return await this.client.get(clave);
    } catch {
      // Cualquier error se trata como "sin caché", no tumba la petición.
      return null;
    }
  }

  // Lee un JSON de Redis. null = no hay clave, Redis caído o JSON malo.
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

  // Guarda un objeto como JSON con caducidad en segundos (EX).
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

  // Cambia el UUID de versión. Los listados guardados con la versión
  // anterior ya no se encuentran; no hace falta un DEL de cada clave.
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
