# Despliegue y operación

## Alcance

La entrega utiliza Docker Compose para ejecutar seis servicios:

- PostgreSQL.
- Redis.
- RabbitMQ.
- API.
- Worker.
- Frontend.

La configuración permite una evaluación local. No se ha desplegado
en un servidor público.

## Preparación

Consultar el README para instalar los requisitos, descargar el repositorio,
crear `.env` y generar la clave JWT.

El README distingue los comandos de CMD, PowerShell, macOS y Linux.

Para ejecutar mediante Docker no se necesita instalar Node.js,
PostgreSQL, Redis o RabbitMQ directamente en el equipo.

Los comandos de Docker y Git de este documento funcionan en CMD,
PowerShell, Terminal de macOS y Linux. Ejecutarlos desde la raíz
del repositorio.

## Variables de entorno

| Variable          | Uso                                             |
| ----------------- | ----------------------------------------------- |
| POSTGRES_DB       | Nombre de la base de datos.                     |
| POSTGRES_USER     | Usuario de PostgreSQL.                          |
| POSTGRES_PASSWORD | Contraseña de PostgreSQL.                       |
| POSTGRES_HOST     | Host para ejecución local fuera de Docker.      |
| POSTGRES_PORT     | Puerto publicado de PostgreSQL en el equipo.    |
| JWT_SECRET        | Clave utilizada para firmar y verificar tokens. |
| REDIS_HOST        | Host de Redis para ejecución local.             |
| REDIS_PORT        | Puerto de Redis.                                |
| RABBITMQ_USER     | Usuario de RabbitMQ.                            |
| RABBITMQ_PASSWORD | Contraseña de RabbitMQ.                         |
| RABBITMQ_HOST     | Host de RabbitMQ para ejecución local.          |
| RABBITMQ_PORT     | Puerto de conexión AMQP.                        |

Dentro de Docker, Compose reemplaza los hosts por los nombres
de los servicios y utiliza sus puertos internos.

Por ejemplo, PostgreSQL se alcanza desde la API como `postgres:5432`,
aunque el equipo lo publique en otro puerto.

El archivo `.env` contiene credenciales y no debe incluirse en Git.

## Inicio

```text
docker compose up -d --build --wait
docker compose ps
```

La secuencia de inicio es:

1. PostgreSQL, Redis y RabbitMQ alcanzan su estado saludable.
2. La API ejecuta las migraciones pendientes.
3. La API ejecuta el seed.
4. La API inicia y su healthcheck consulta `/health`.
5. Frontend y worker pueden iniciar cuando la API está saludable.

Si fallan las migraciones o el seed, la API no continúa con el arranque.

El seed inserta usuarios y paquetes de demostración sin reemplazar
registros existentes que tengan los mismos identificadores únicos.

## Verificación

Abrir estas direcciones en el navegador:

- Frontend: http://localhost:8080
- Swagger: http://localhost:3000/docs
- Dependencias: http://localhost:3000/health
- RabbitMQ: http://localhost:15672

El endpoint `/health` debe responder:

```json
{
  "status": "ok",
  "servicios": {
    "postgres": "up",
    "redis": "up",
    "rabbitmq": "up"
  }
}
```

Revisar los logs:

```text
docker compose logs --tail=100 api
docker compose logs --tail=100 worker
```

El worker debe indicar que espera eventos `reserva.creada`.
Crear una reserva permite comprobar el procesamiento de una notificación.

El estado `Up` del worker indica que su proceso está ejecutándose.
Actualmente no tiene un healthcheck propio.

## Actualización

Antes de actualizar una instalación con información importante:

1. Identificar el commit que se encuentra funcionando.
2. Realizar y comprobar un respaldo de PostgreSQL.
3. Revisar las migraciones nuevas y su compatibilidad con los datos.

Actualizar desde la raíz:

```text
git pull --ff-only
docker compose up -d --build --wait
docker compose ps
```

La API aplica automáticamente las migraciones pendientes durante
el arranque. Después, comprobar login, listados, reservaciones y worker.

## Migraciones

Consultar su estado:

```text
docker compose exec api node node_modules/typeorm/cli.js migration:show -d dist/database/data-source.js
```

Las migraciones se generan durante el desarrollo y se incluyen en Git.
La imagen contiene sus archivos compilados en `dist`.

No se deben editar migraciones ya ejecutadas para introducir cambios
de esquema. Cada cambio nuevo debe tener una migración nueva.

## Reinicios y conexiones

Para reiniciar únicamente la API:

```text
docker compose restart api
```

Para reiniciar el worker:

```text
docker compose restart worker
```

Si RabbitMQ vuelve a estar disponible después de una desconexión,
puede ser necesario reiniciar la API para restablecer su conexión.

El worker tiene `restart: on-failure`: Docker lo reinicia si termina
con error. Esto no sustituye la supervisión de sus conexiones y actividad.

## Persistencia y respaldos

PostgreSQL utiliza el volumen `postgres_data`.
RabbitMQ utiliza el volumen `rabbitmq_data`.

Los volúmenes conservan información al recrear los contenedores.
No sustituyen un respaldo independiente.

Para una instalación con datos importantes, utilizar `pg_dump`
o una solución equivalente, guardar la copia fuera del contenedor
y comprobar su restauración en otra base de datos.

No utilizar `docker compose down -v` cuando se necesiten conservar
los datos: elimina los volúmenes del proyecto.

## Recuperación de una actualización fallida

No ejecutar un rollback de base de datos automáticamente.

Primero identificar si el fallo corresponde a la aplicación,
una dependencia o una migración.

Si la versión anterior de la aplicación es compatible con el esquema
actual, se puede reconstruir esa versión para recuperar el servicio.

Si hubo cambios incompatibles en el esquema, preparar una migración
correctiva o una restauración comprobada. Revertir código por sí solo
no revierte los cambios realizados en PostgreSQL.

## Detener y volver a iniciar

```text
docker compose down
docker compose up -d --wait
```

Estos comandos conservan los volúmenes existentes.

## Consideraciones para producción

La configuración entregada publica los puertos en `127.0.0.1`
para acceso local.

Un despliegue público necesitaría, entre otras medidas:

- Dominio, HTTPS y configuración del proxy.
- Secretos y usuarios distintos de los de demostración.
- Retirar o deshabilitar las cuentas de prueba y su seed automático.
- Respaldos y restauración verificados.
- Monitoreo de errores, latencia y acumulación de mensajes.
- Reconexión de RabbitMQ y supervisión del worker.
- Contadores de login compartidos si existen varias instancias.
- Outbox si se requiere recuperar automáticamente avisos pendientes.

Estas medidas describen trabajo adicional; no se presentan como
funcionalidades ya implementadas.
