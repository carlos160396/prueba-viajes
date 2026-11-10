# Uso de IA

Utilicé ChatGPT como apoyo para revisar código, resolver dudas y comparar
opciones durante el desarrollo. Fui aplicando los cambios por partes
y comprobando su funcionamiento antes de continuar.

## Forma de trabajo

La implementación y los commits se realizaron desde mi equipo.
La IA proporcionó sugerencias y fragmentos de código para revisar.

Las pautas de trabajo fueron:

- Mantener el alcance de la prueba y dejar las mejoras adicionales
  como propuestas.
- Consultar las sugerencias antes de aplicarlas.
- Realizar los commits bajo mi control.
- Revisar las explicaciones y comprobar los cambios en la aplicación.

## Decisiones que tomé

Una decisión fue desactivar los paquetes en lugar de eliminarlos.
Consideré importante conservarlos para mantener el historial de
las reservaciones, por lo que se agregó el campo booleano `activo`.

También prioricé tener el flujo principal funcionando y avanzar
con el frontend antes de seguir agregando mejoras al backend.
Las limitaciones restantes quedaron documentadas.

## Ejemplos de consultas

Consultas realizadas, resumidas:

- Comparar la eliminación de paquetes con su desactivación para
  conservar el historial de reservaciones.
- Revisar si el bloqueo elegido permite controlar el cupo sin
  afectar las reservas de otros paquetes.
- Evaluar cómo invalidar la caché cuando cambia la disponibilidad.
- Revisar los casos de prueba necesarios para permisos,
  cupo insuficiente y cancelaciones repetidas.
- Identificar diferencias en los comandos de instalación
  para Mac y Windows.

## Propuestas revisadas y corregidas

### Desactivación de paquetes

La propuesta inicial contemplaba eliminar paquetes. Decidí utilizar
el campo `activo` para desactivarlos y conservar el historial
de las reservaciones.

### Compatibilidad de Swagger

La instalación propuesta tomaba la versión más reciente de Swagger,
pero requería una versión de NestJS diferente a la del proyecto.
Se ajustó la dependencia a Swagger 11 para mantener la compatibilidad
sin actualizar todo el backend.

### Configuración de pruebas

La configuración inicial de Jest no podía cargar algunas dependencias
ESM. Cambiar únicamente la versión de Node no solucionó el problema.
Se revisó la configuración de Jest y ts-jest, y se comprobó el ajuste
ejecutando nuevamente las pruebas.

## Validación

Probé las rutas con curl, Swagger y el frontend, y revisé los datos
en pgAdmin. Comprobé permisos, cupos, cancelaciones, caché y
procesamiento de notificaciones.

Resultados:

- 39 pruebas del backend y 4 del frontend aprobadas.
- Lint y compilación de ambos proyectos.
- GitHub Actions aprobado.
- 87.33 % de cobertura de líneas en servicios de negocio.
- 39.8 % de cobertura global del backend.

Las instrucciones para Windows están documentadas, pero no se
comprobaron en un equipo Windows.
