import * as amqp from 'amqplib';
import { isUUID } from 'class-validator';
import dataSource from './database/data-source';
import { Notificacion } from './notificaciones/notificacion.entity';
import { COLA_RESERVA_CREADA } from './mensajeria/mensajeria.service';
import type { EventoReservaCreada } from './mensajeria/mensajeria.service';

// Proceso aparte de la API. Escucha la cola `reserva.creada` y guarda
// una fila en `notificaciones` por cada reserva.
//
// Flujo:
//   API crea reserva -> publica { eventoId, reservacionId } en RabbitMQ
//   -> este worker consume el mensaje -> INSERT en notificaciones.
//
// Por qué no lo hace la API en el mismo request:
//   Si RabbitMQ o la tabla fallan, la reserva ya está guardada.
//   El worker reintenta; la API no se queda esperando.

function esEventoValido(valor: unknown): valor is EventoReservaCreada {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }

  const evento = valor as Record<string, unknown>;

  // Ambos ids deben ser UUID v4; si no, el mensaje se descarta.
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
    // Si se cierra sin SIGTERM/SIGINT, Docker/el proceso padre debe
    // levantar otra instancia. process.exit(1) marca fallo.
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

  // Misma cola que publica MensajeriaService. durable = sobrevive reinicios.
  await canal.assertQueue(COLA_RESERVA_CREADA, {
    durable: true,
  });

  // prefetch(1): no toma un segundo mensaje hasta ack/nack del actual.
  // Evita que un worker lento acumule trabajo sin procesar.
  await canal.prefetch(1);

  async function procesar(mensaje: amqp.ConsumeMessage): Promise<void> {
    let evento: unknown;

    try {
      evento = JSON.parse(mensaje.content.toString()) as unknown;
    } catch {
      // nack(..., false, false) = no reencolar. JSON basura no se reintenta.
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
      // orIgnore: si evento_id ya existe (reentrega), no inserta otra fila.
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
      // Fallo temporal de BD: espera 1s y reencola (requeue = true).
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

    // ack = "ya lo procesé, quítalo de la cola".
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
    // noAck: false = nosotros hacemos ack/nack a mano (arriba).
    { noAck: false },
  );

  async function cerrar(): Promise<void> {
    if (cerrando) return;
    cerrando = true;

    await canal.close();
    await conexion.close();
    await dataSource.destroy();
  }

  // Docker envía SIGTERM al parar el contenedor.
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
