# Sistema de Inventario SENATI

Proyecto académico Full Stack con autenticación JWT, permisos por rol
y control de inventario mediante Kardex.

## Tecnologías

- Backend: Node.js, Express, Sequelize y MySQL.
- Frontend: React, Vite, React Router y Axios.
- Seguridad: Scrypt, JWT HS256, Helmet, CORS y Rate Limit.

## Funcionalidades

- Inicio y cierre de sesión.
- Rutas protegidas en React.
- Administración de productos, categorías, proveedores y usuarios.
- Dashboard del inventario.
- Registro de entradas, salidas y ajustes.
- Anulación mediante movimientos compensatorios.
- Conservación del historial del Kardex.

## Roles

| Módulo | Administrador | Almacenero | Supervisor |
|---|---|---|---|
| Productos | Consultar, crear, editar y eliminar | Consultar, crear y editar | Consultar |
| Categorías y proveedores | Consultar, crear, editar y eliminar | Consultar | Consultar |
| Usuarios | Administrar | Sin acceso | Sin acceso |
| Kardex | Consultar, registrar y anular | Consultar y registrar | Consultar |
| Dashboard | Consultar | Consultar | Consultar |

Los permisos se validan en el backend. Ocultar botones en React no sustituye
la autorización de la API.

## Estructura

- `appInventario/`: frontend React.
- `config/`: conexión con MySQL.
- `models/`: modelos y asociaciones.
- `middleware/`: autenticación y autorización.
- `routes/`: rutas de autenticación.
- `services/`: operaciones del inventario y Kardex.
- `scripts/`: migraciones y pruebas.
- `app.js`: aplicación Express.
- `index.js`: arranque del backend.

## Configuración del backend

Desde la raíz del proyecto:

```bash
npm ci
```

Copia `.env.example` como `.env` y configura los datos de tu MySQL local.

Genera un secreto JWT con:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Guárdalo únicamente en `JWT_SECRET` dentro de `.env`.
No lo publiques ni lo incluyas en capturas.

Crea una base de datos vacía antes de iniciar por primera vez:

```sql
CREATE DATABASE api_backend
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

Si la base ya existe, utiliza la existente. No la elimines ni la recrees.

Inicia el backend:

```bash
npm run dev
```

El arranque ejecuta la migración definida en `scripts/migrate.js`.
No utiliza `sync({ force: true })`.

Dirección local:

```text
http://localhost:3006
```

Comprobación de conexión:

```text
GET http://localhost:3006/api/health
```

## Configuración del frontend

En otra terminal:

```bash
cd appInventario
npm ci
npm run dev
```

Dirección local habitual:

```text
http://127.0.0.1:5173
```

Vite redirige las solicitudes `/api` al backend local mediante su proxy.
El cliente utiliza `/api` como URL base si no se configura `VITE_API_URL`.

## Acceso inicial

## Acceso inicial

En una instalación nueva, después de configurar `.env` y crear la base
de datos, ejecuta desde la raíz del backend:

```bash
npm run migrate
node scripts/crear-admin.js
```

El asistente muestra la base configurada y solicita confirmación,
nombre, correo y contraseña. La contraseña no se muestra al escribir
y se almacena mediante Scrypt.

Si ya existe un Administrador activo, termina sin modificar usuarios.
No incluye credenciales predeterminadas.

Ejecuta el asistente una sola vez a la vez y únicamente desde una
terminal local autorizada.

En Git Bash, si solicita una terminal interactiva:

```bash
winpty node scripts/crear-admin.js
```

El alta inicial, el login y la prevención de una segunda creación fueron
verificados en una base temporal independiente.

## Autenticación

```text
POST /api/auth/login
```

El frontend conserva el JWT en `localStorage`, según la guía del laboratorio,
y lo adjunta como `Authorization: Bearer`.

Una respuesta 401 en una ruta protegida elimina la sesión del navegador.
Una respuesta 403 indica que el usuario no tiene permiso para la operación.

`localStorage` es accesible desde JavaScript y requiere medidas de prevención
contra XSS. No debe considerarse un almacén inmune a ese riesgo.

## Kardex

- El stock se modifica mediante movimientos.
- El responsable se obtiene del usuario autenticado.
- El stock inicial también se atribuye al usuario autenticado.
- Las anulaciones generan movimientos compensatorios.
- Los productos con historial no pueden eliminarse.

## Verificaciones

Backend, desde la raíz:

```bash
npm test
```

La prueba de seguridad genera una base temporal con prefijo
`inventario_test_`, crea usuarios y credenciales temporales y elimina esa
base al terminar.

El usuario MySQL empleado para las pruebas necesita permisos para crear
y eliminar bases temporales. No se debe conceder ese permiso a una cuenta
de producción únicamente para ejecutar pruebas.

Resultado verificado: 60 comprobaciones de autenticación, roles y Kardex.

El archivo anterior `scripts/test-api.js` conserva pruebas previas a la
autenticación y necesita adaptación antes de volver a utilizarse.

Frontend, desde `appInventario`:

```bash
npm run lint
npm run build
```

Estas comprobaciones no equivalen a una auditoría completa de seguridad
ni cubren todos los escenarios de regresión.

## Archivos excluidos

No publicar:

- `.env` ni sus variantes con configuración real.
- Contraseñas, secretos JWT o tokens.
- Respaldos SQL con datos.
- `node_modules/`.
- Compilaciones `dist/`.
- Logs con información sensible.

El archivo `.env.example` contiene únicamente configuración de ejemplo.

## Estado

Laboratorios 10 y 11 implementados y documentados.

Revisión integral en curso. Se verificaron autenticación, permisos principales,
atribución del responsable del Kardex, análisis estático y compilación del
frontend.

Pendientes de la revisión: completar la regresión general, probar de forma
controlada la expiración JWT en React.