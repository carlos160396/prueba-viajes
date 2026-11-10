import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export const COLA_RESERVA_CREADA = 'reserva.creada';

export interface EventoReservaCreada {
  eventoId: string;
  reservacionId: string;
}

@Injectable()
export class MensajeriaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MensajeriaService.name);

  private conexion?: Awaited<ReturnType<typeof amqp.connect>>;
  private canal?: amqp.ConfirmChannel;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.conexion = await amqp.connect(
      {
        protocol: 'amqp',
        hostname: this.config.getOrThrow<string>('RABBITMQ_HOST'),
        port: Number(this.config.getOrThrow<string>('RABBITMQ_PORT')),
        username: this.config.getOrThrow<string>('RABBITMQ_USER'),
        password: this.config.getOrThrow<string>('RABBITMQ_PASSWORD'),
        heartbeat: 30,
      },
      { timeout: 5000 },
    );

    this.conexion.on('error', () => {
      this.logger.error('Error de conexión con RabbitMQ');
    });

    this.conexion.on('close', () => {
      this.canal = undefined;
      this.logger.warn('Conexión con RabbitMQ cerrada');
    });

    const canal = await this.conexion.createConfirmChannel();

    canal.on('error', () => {
      this.logger.error('Error en el canal de RabbitMQ');
    });

    canal.on('close', () => {
      if (this.canal === canal) {
        this.canal = undefined;
      }
    });

    await canal.assertQueue(COLA_RESERVA_CREADA, {
      durable: true,
    });

    this.canal = canal;

    this.logger.log('RabbitMQ conectado y cola preparada');
  }

  async publicarReservaCreada(evento: EventoReservaCreada): Promise<void> {
    const canal = this.canal;

    if (!canal) {
      throw new ServiceUnavailableException(
        'Servicio de mensajería no disponible',
      );
    }

    await new Promise<void>((resolve, reject) => {
      canal.sendToQueue(
        COLA_RESERVA_CREADA,
        Buffer.from(JSON.stringify(evento)),
        {
          persistent: true,
          contentType: 'application/json',
          type: COLA_RESERVA_CREADA,
          messageId: evento.eventoId,
        },
        (error: Error | null) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        },
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.canal?.close();
    } finally {
      await this.conexion?.close();
    }
  }
}
