# Prueba técnica — Reservaciones de viajes

Aplicación para administrar paquetes de viaje y reservaciones con acceso
por roles: administrador, agente y cliente.

## Tecnologías

- Backend: NestJS, TypeScript y TypeORM.
- Base de datos: PostgreSQL.
- Frontend: React, Vite, TypeScript, Tailwind y Zustand.
- Caché: Redis.
- Mensajería: RabbitMQ y worker independiente.
- Infraestructura: Docker Compose.
- CI: GitHub Actions.

## Requisitos

Para ejecutar la aplicación:

- Git.
- Docker con Docker Compose v2.

Para ejecutar pruebas fuera de Docker:

- Node.js 24 y npm.

### Windows

- Git instalado.
- Docker Desktop iniciado y configurado para contenedores Linux,
  preferentemente con el backend WSL2.
- Los comandos pueden ejecutarse desde CMD, PowerShell o Ubuntu/WSL.
  No es obligatorio abrir la terminal de WSL.

### macOS

- Git instalado.
- Docker Desktop instalado e iniciado.
- Ejecutar los comandos desde Terminal.

### Linux

- Git, Docker Engine y el plugin Docker Compose v2 instalados.
- Docker iniciado y accesible desde la terminal.

## Instalación nueva

Instalar Git y Docker Desktop. En Windows, configurar Docker Desktop
para contenedores Linux y mantenerlo encendido.

### 1. Descargar el proyecto — todas las terminales

```text
git clone https://github.com/carlos160396/prueba-viajes.git
cd prueba-viajes
```

### 2. Crear la configuración — elegir según la terminal

Linux, macOS o Ubuntu/WSL:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Windows CMD:

```cmd
copy .env.example .env
```

### 3. Configurar las variables

Abrir `.env` y configurar las credenciales de PostgreSQL, RabbitMQ y
una clave JWT propia.

En Windows se puede abrir con:

```text
notepad .env
```

Para generar una clave JWT, ejecutar el comando correspondiente:

Linux, macOS o Ubuntu/WSL:

```bash
openssl rand -hex 32
```

Windows PowerShell:

```powershell
$jwtBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($jwtBytes)
[System.BitConverter]::ToString($jwtBytes).Replace('-', '').ToLowerInvariant()
$rng.Dispose()
```

Desde Windows CMD, ejecutar:

```cmd
powershell -NoProfile -Command "$b = New-Object byte[] 32; $r = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $r.GetBytes($b); [System.BitConverter]::ToString($b).Replace('-', '').ToLowerInvariant(); $r.Dispose()"
```

Copiar la clave generada en `JWT_SECRET` dentro de `.env` y guardar.

No subir `.env` al repositorio.

### 4. Iniciar — todas las terminales

```text
docker compose up -d --build --wait
docker compose ps
```

La API ejecuta las migraciones pendientes y el seed antes de iniciar.
No se utiliza `synchronize` para modificar el esquema.

El seed crea tres usuarios y doce paquetes de demostración.
Ejecutarlo nuevamente no duplica esos registros ni restablece los
precios o cupos de paquetes existentes.

Abrir http://localhost:8080.

Para ejecutar la aplicación con Docker no es necesario instalar
Node.js ni PostgreSQL en el equipo.

## Accesos locales

| Servicio                   | Dirección                    |
| -------------------------- | ---------------------------- |
| Frontend                   | http://localhost:8080        |
| API                        | http://localhost:3000        |
| Swagger                    | http://localhost:3000/docs   |
| Estado de dependencias     | http://localhost:3000/health |
| Administración de RabbitMQ | http://localhost:15672       |

Las credenciales de RabbitMQ son las configuradas en `.env`.

## Usuarios de prueba

Contraseña para los tres usuarios: `Prueba123!`.

| Rol           | Email               |
| ------------- | ------------------- |
| Administrador | admin@example.com   |
| Agente        | agente@example.com  |
| Cliente       | cliente@example.com |

Estas cuentas son exclusivamente para demostración.

## Permisos

- Administrador: crear, editar y desactivar paquetes; consultar todas
  las reservaciones.
- Agente: crear reservaciones para clientes, consultar reservaciones
  y cambiar su estado de pago.
- Cliente: crear y consultar sus propias reservaciones.

La API comprueba los permisos; ocultar una opción en el frontend no
reemplaza esa validación.

## Recorrido de prueba

1. Iniciar sesión como administrador y consultar los paquetes.
2. Probar filtros por destino, fechas y precio máximo.
3. Cambiar de página con un límite de diez paquetes.
4. Iniciar sesión como cliente y crear una reservación.
5. Comprobar que disminuyó el cupo disponible.
6. Como agente, cambiar el estado a PAGADA o CANCELADA.
7. Al cancelar, comprobar que el cupo se devuelve una sola vez.
8. Revisar el worker y la tabla `notificaciones`.

Para probar endpoints desde Swagger, ejecutar el login, copiar
`access_token` y pegarlo en Authorize, sin anteponer `Bearer`.

## Consistencia de las reservaciones

La creación utiliza una transacción y un bloqueo de escritura del paquete.
El descuento de cupo y la reservación se guardan juntos.

La API calcula el importe con decimal.js y conserva el precio unitario
en la reservación. Un cambio posterior del precio del paquete no modifica
las reservaciones existentes.

Los paquetes se desactivan mediante el campo `activo`, conservando
el historial de las reservaciones.

## Redis y RabbitMQ

Los listados de paquetes se almacenan en Redis durante 60 segundos.
Las modificaciones cambian la versión de la caché para que las siguientes
consultas obtengan información actualizada.

Si Redis no está disponible, el listado consulta PostgreSQL.

Después de confirmar una reservación, la API publica `reserva.creada`.
El worker registra una notificación simulada en PostgreSQL.

`evento_id` tiene una restricción única para evitar registros duplicados
cuando se procesa nuevamente el mismo evento. No se envían correos reales.

## Estado y logs

`GET /health` verifica PostgreSQL, Redis y RabbitMQ:

- HTTP 200: las tres dependencias respondieron.
- HTTP 503: alguna dependencia falló.

Las peticiones HTTP generan logs JSON con método, ruta, estado,
duración y `requestId`. La respuesta incluye el mismo identificador
en `X-Request-Id`.

Los mensajes de arranque de Nest conservan su formato de consola.

```bash
docker compose logs --tail=100 api
docker compose logs --tail=100 -f worker
```

## Pruebas del backend

```bash
cd backend
npm ci
npm run lint
npm test -- --runInBand
npm run build
```

Cobertura global:

```bash
npm run test:cov -- --runInBand
```

Cobertura específica de servicios de negocio:

```bash
npm run test:cov -- --runInBand --collectCoverageFrom='{auth,paquetes,reservaciones}/*.service.ts'
```

Resultados obtenidos durante la preparación de la entrega:

- 39 pruebas del backend aprobadas.
- Servicios de negocio: 87.33 % de líneas y 78.74 % de ramas.
- Cobertura global del backend: 39.8 % de líneas.

Los porcentajes tienen alcances diferentes. Las pruebas unitarias usan
dependencias simuladas y no sustituyen una prueba de concurrencia real
contra PostgreSQL.

Jest utiliza VM Modules para cargar las dependencias ESM.
Node puede mostrar un `ExperimentalWarning` al ejecutar las pruebas.

## Pruebas del frontend

Desde la raíz del repositorio:

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
```

Se comprobaron cuatro pruebas de interfaz.

## Integración continua

GitHub Actions verifica:

- Lint, pruebas y compilación del backend y frontend.
- Cobertura mínima de 60 % en los tres servicios de negocio:
  autenticación, paquetes y reservaciones.
- Construcción de imágenes Docker de API, worker y frontend.

Las imágenes se construyen para verificación; no se publican.
El flujo se encuentra en `.github/workflows/ci.yml`.

## Detener y volver a iniciar

```bash
docker compose down
docker compose up -d --wait
```

`docker compose down` conserva los volúmenes de PostgreSQL y RabbitMQ.
La opción `-v` elimina esos volúmenes y sus datos.

## Limitaciones y mejoras pendientes

| Limitación actual                                                                                             | Solución propuesta                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Si RabbitMQ falla después de guardar una reserva, el aviso puede quedar sin enviar.                           | Implementar outbox: guardar un aviso pendiente junto con la reserva y reintentar su envío hasta recibir confirmación.                                                       |
| Un doble clic o reintento puede crear dos reservas si hay cupo suficiente.                                    | Asignar un identificador al intento de reserva y conservarlo en los reintentos. El backend debe garantizar su unicidad y devolver la reserva existente si ya fue procesado. |
| Si falla la invalidación de Redis, puede mostrarse un listado anterior hasta que venza su TTL de 60 segundos. | Guardar la invalidación pendiente y reintentarla cuando Redis se recupere.                                                                                                  |
| La API necesita reiniciarse si pierde la conexión con RabbitMQ.                                               | Implementar reconexión automática y volver a preparar el canal antes de publicar mensajes.                                                                                  |
| El contador de intentos de login se reinicia con la API y no se comparte entre instancias.                    | Guardar los contadores en Redis para mantener un límite compartido entre las instancias de la API.                                                                          |
| Docker comprueba que el worker está ejecutándose, pero no que esté procesando correctamente.                  | Agregar un healthcheck que compruebe su conexión con PostgreSQL, su suscripción a RabbitMQ y una señal periódica de actividad.                                              |

Estas soluciones están propuestas; todavía no forman parte de la
implementación entregada.
