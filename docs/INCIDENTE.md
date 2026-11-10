# Revisión de un incidente

Si después de una migración aparecen errores 500, las solicitudes
tardan más y se acumulan mensajes en RabbitMQ, revisaría lo siguiente.

## Revisar el problema

Primero identificaría qué cambió en la última actualización y cuáles
acciones están fallando. También comprobaría si las reservas se guardan
aunque el usuario reciba un error, para evitar duplicarlas al reintentar.

Revisaría `/health` y usaría el `requestId` para ubicar las peticiones
con error. Buscaría migraciones pendientes, columnas faltantes,
problemas de conexión o consultas bloqueadas.

## Revisar RabbitMQ

En la cola `reserva.creada` comprobaría cuántos mensajes están pendientes
y si el worker está conectado. Si está reintentando los mismos mensajes,
revisaría por qué no puede guardar las notificaciones en PostgreSQL.

No borraría la cola para quitar la acumulación.

## Corregir y comprobar

La solución dependería de la causa. Reiniciar puede recuperar una
conexión, pero no corrige una migración incorrecta.

Antes de regresar a una versión anterior, haría un respaldo y revisaría
su compatibilidad con la base de datos. No ejecutaría el `down` de una
migración sin comprobar qué información puede eliminar.

Después probaría login, consulta de paquetes, creación y cancelación
de reservas. Revisaría que el cupo sea correcto, que el worker procese
los pendientes y que bajen los errores y tiempos de respuesta.

Finalmente dejaría por escrito la causa y la solución. Para prevenirlo,
agregaría pruebas de migraciones, reservas simultáneas y alertas de
errores y mensajes pendientes.
