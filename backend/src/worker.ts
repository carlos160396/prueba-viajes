import * as amqp from 'amqplib';
import { isUUID } from 'class-validator';
import dataSource from './database/data-source';
import { Notificacion } from './notificaciones/notificacion.entity';
import { COLA_RESERVA_CREADA } from './mensajeria/mensajeria.service';
import type { EventoReservaCreada } from './mensajeria/mensajeria.service';

function esEventoValido(valor: unknown): valor is EventoReservaCreada {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }

  const evento = valor as Record<string, unknown>;

  return (
    typeof evento.eventoId === 'string' &&
    isUUID(evento.eventoId, '4') &&
    typeof evento.reservacionId === 'string' &&
    isUUID(evento.reservacionId, '4')
  );
}

async function iniciarWorker(): Promise<void> {
  await dataSource.initialize();

  const conexion = await amqp.connect(
    {
      protocol: 'amqp',
      hostname: process.env.RABBITMQ_HOST,
      port: Number(process.env.RABBITMQ_PORT),
      username: process.env.RABBITMQ_USER,
      password: process.env.RABBITMQ_PASSWORD,
      heartbeat: 30,
    },
    { timeout: 5000 },
  );

  conexion.on('error', () => {
    console.error(
      JSON.stringify({
        nivel: 'error',
        mensaje: 'Error de conexión del worker con RabbitMQ',
      }),
    );
  });

  let cerrando = false;

  conexion.on('close', () => {
    if (!cerrando) {
      console.error(
        JSON.stringify({
          nivel: 'error',
          mensaje: 'Conexión cerrada; el worker debe reiniciarse',
        }),
      );

      process.exit(1);
    }
  });

  const canal = await conexion.createChannel();

  canal.on('error', () => {
    console.error(
      JSON.stringify({
        nivel: 'error',
        mensaje: 'Error en el canal del worker',
      }),
    );
  });

  canal.on('close', () => {
    if (!cerrando) {
      process.exit(1);
    }
  });

  await canal.assertQueue(COLA_RESERVA_CREADA, {
    durable: true,
  });

  await canal.prefetch(1);

  async function procesar(mensaje: amqp.ConsumeMessage): Promise<void> {
    let evento: unknown;

    try {
      evento = JSON.parse(mensaje.content.toString()) as unknown;
    } catch {
      canal.nack(mensaje, false, false);
      console.error(
        JSON.stringify({
          nivel: 'error',
          mensaje: 'Mensaje descartado: JSON inválido',
        }),
      );
      return;
    }

    if (!esEventoValido(evento)) {
      canal.nack(mensaje, false, false);
      console.error(
        JSON.stringify({
          nivel: 'error',
          mensaje: 'Mensaje descartado: formato inválido',
        }),
      );
      return;
    }

    try {
      await dataSource
        .createQueryBuilder()
        .insert()
        .into(Notificacion)
        .values({
          eventoId: evento.eventoId,
          reservacionId: evento.reservacionId,
        })
        .orIgnore()
        .execute();
    } catch {
      console.error(
        JSON.stringify({
          nivel: 'error',
          mensaje: 'No se pudo guardar la notificación; se reintentará',
          eventoId: evento.eventoId,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));

      canal.nack(mensaje, false, true);
      return;
    }

    canal.ack(mensaje);

    console.log(
      JSON.stringify({
        nivel: 'info',
        mensaje: 'Evento procesado sin duplicar notificaciones',
        eventoId: evento.eventoId,
        reservacionId: evento.reservacionId,
      }),
    );
  }

  await canal.consume(
    COLA_RESERVA_CREADA,
    (mensaje) => {
      if (mensaje) {
        void procesar(mensaje).catch(() => {
          console.error(
            JSON.stringify({
              nivel: 'error',
              mensaje: 'Fallo inesperado; se reiniciará el worker',
            }),
          );

          process.exit(1);
        });
      }
    },
    { noAck: false },
  );

  async function cerrar(): Promise<void> {
    if (cerrando) return;
    cerrando = true;

    await canal.close();
    await conexion.close();
    await dataSource.destroy();
  }

  for (const señal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(señal, () => {
      void cerrar().catch(() => process.exit(1));
    });
  }

  console.log(
    JSON.stringify({
      nivel: 'info',
      mensaje: 'Worker esperando eventos reserva.creada',
    }),
  );
}

void iniciarWorker().catch(() => {
  console.error(
    JSON.stringify({
      nivel: 'error',
      mensaje: 'No se pudo iniciar el worker',
    }),
  );

  process.exit(1);
});
