# Revisión de un incidente

## Situación

Después de una actualización, el 12 % de las solicitudes para reservar
responde 500, el tiempo p95 sube de 300 ms a 4 segundos y RabbitMQ acumula
15,000 mensajes. Una hora antes se agregó un campo a reservaciones.

Este es un caso de ejemplo, no un incidente ocurrido en el proyecto.

## Posibles causas, en orden de revisión

1. La nueva versión no coincide con la estructura de PostgreSQL.
   Revisaría primero la migración porque es el cambio más reciente
   y puede afectar tanto a la API como al worker.

2. Hay operaciones bloqueadas o demasiadas conexiones ocupadas.
   Esto podría explicar la lentitud y que otras solicitudes fallen
   mientras esperan.

3. El worker está detenido o falla al guardar notificaciones.
   Si la nueva estructura también afecta sus operaciones, podría
   estar reintentando mensajes y aumentando la cola.

## Qué haría primero

Avisaría que estamos revisando el problema y pausaría nuevos despliegues.
Si las reservas siguen fallando, limitaría temporalmente esa operación
para evitar que los usuarios repitan intentos sin saber si se guardaron.

Revisaría el estado de los contenedores y los registros de API y worker.
Buscaría las peticiones fallidas por requestId, su duración y los errores
cercanos a la hora del despliegue.

En PostgreSQL comprobaría migraciones, consultas lentas, bloqueos,
transacciones abiertas y conexiones ocupadas.

Revisaría los cambios de la última actualización: el código modificado,
la migración y si el nuevo campo es obligatorio o tiene un valor por
defecto. También comprobaría cómo lo utilizan la API y el worker,
y qué pasa con las reservaciones que ya existían.

Compararía esos cambios con la versión anterior para buscar una relación
con los errores, sin asumir que la actualización es la causa hasta
confirmarlo.

En RabbitMQ revisaría mensajes pendientes, mensajes sin confirmar,
consumidores conectados y velocidad de procesamiento. También compararía
errores y tiempos de respuesta antes y después del despliegue.

## Corrección y riesgos

Si el problema está en la nueva versión, regresaría a la anterior
solo si todavía funciona con la estructura actual de la base de datos.
De lo contrario, prepararía una migración correctiva.

No ejecutaría un down sin revisar qué elimina y contar con un respaldo:
podría perder información.

Si el problema está en el worker, corregiría su error y lo reiniciaría.
Aumentar workers solo sería útil si falta capacidad; si PostgreSQL está
saturado, podría empeorar el problema.

No borraría la cola. Después comprobaría reservas, cupos, cancelaciones
y notificaciones antes de reabrir las operaciones afectadas.

## Alerta propuesta en Grafana

Configuraría una alerta si ocurre cualquiera de estas condiciones:

- Más del 5 % de errores 500 en POST /reservaciones durante 5 minutos.
- Tiempo p95 mayor a 1 segundo durante 5 minutos.
- Más de 1,000 mensajes pendientes durante 5 minutos y la cola sigue creciendo.

Notificaría al responsable de soporte técnico y al equipo de desarrollo
por el canal de incidentes y correo.

Estas alertas requieren recopilar las métricas de HTTP y RabbitMQ.
Todavía no están implementadas en el proyecto.

## Comunicación

“Desde hace 20 minutos tenemos 12 % de errores 500 en reservas,
p95 de 4 segundos y 15,000 mensajes pendientes. Se pausaron despliegues.
Primero revisaremos compatibilidad de la migración, bloqueos y conexiones
de PostgreSQL; después, errores y consumo del worker.”

## Seguimiento

Al recuperar el servicio comprobaría que los errores bajen, los tiempos
se normalicen y la cola disminuya. Revisaría también posibles reservas
duplicadas o avisos pendientes.

Documentaría la causa y agregaría pruebas de migraciones, reservas
simultáneas y recuperación de mensajes para prevenir otro caso similar.
