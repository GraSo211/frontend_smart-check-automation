# Smart-Check Automation

Frontend de **Smart-Check Automation** para la supervisión de producción de la
panificadora industrial **Fermar S.A.**. Centraliza el estado de la operación,
los lotes, la telemetría IoT Edge, los parámetros de producto, los usuarios y la
supervisión de video en vivo.

Este repositorio documenta y ejecuta el frontend. La API de negocio consumida
es un servicio externo en Go; no forma parte de este proyecto.

## Índice

- [Alcance funcional](#alcance-funcional)
- [Stack y servicios](#stack-y-servicios)
- [Configuración](#configuración)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Arquitectura y flujo de datos](#arquitectura-y-flujo-de-datos)
- [Páginas frontend](#páginas-frontend)
- [API consumida](#api-consumida)
- [Autenticación y autorización](#autenticación-y-autorización)
- [Disponibilidad y tiempo real](#disponibilidad-y-tiempo-real)
- [Problemas frecuentes](#problemas-frecuentes)
- [Despliegue](#despliegue)
- [Estructura del proyecto](#estructura-del-proyecto)

## Alcance funcional

| Área | Funcionalidad actual |
|---|---|
| Operación | Dashboard con indicadores de producción, calidad, temperatura, conectividad y sincronización. |
| Supervisión | Lista y muestra la cámara de los dispositivos que tienen una URL WHEP configurada, con reconexión automática. Por capacidad de las Raspberry, cada nodo expone una sola cámara/stream. |
| Lotes | Consulta de lotes, búsqueda por producto, filtro por turno y rango de temperatura, KPIs y tabla histórica. |
| Configuración | Selección de producto, edición de parámetros de horno/cinta/calidad y consulta del historial de corridas. La edición en la interfaz está habilitada para Supervisor y Administrador. |
| Nodos | Estado de Raspberry Pi, última telemetría, métricas en vivo, historial, alta/edición/baja de dispositivos y la URL WHEP de su cámara. |
| Usuarios | Listado, búsqueda, alta, cambio de rol y activación/desactivación de usuarios corporativos. |
| Alertas | Página de módulo reservada para la gestión de alertas y notificaciones; actualmente muestra una sección informativa. |

## Stack y servicios

| Capa o funcionalidad | Tecnología / dependencia |
|---|---|
| Framework | [Next.js](https://nextjs.org) `16.2.6`, App Router |
| UI | React `19` + TypeScript `5.7.3` |
| Estilos | [Tailwind CSS](https://tailwindcss.com) `4.2.x`, configuración CSS-first |
| Componentes | shadcn/ui `4.8.0`, preset `base-nova`, sobre [Base UI](https://base-ui.com) `1.5.x` |
| Iconos | `lucide-react` `1.16.x` |
| Autenticación Google | `@react-oauth/google` `0.13.x` |
| Sesión / lectura del payload | `jose` `6.2.x` y cookie `session_token` |
| Tiempo real | `EventSource`/SSE del navegador, proxificado por handlers internos de Next.js |
| Video | WebRTC del navegador consumiendo una sesión WHEP de MediaMTX |
| Notificaciones UI | `sonner` |
| Analítica | `@vercel/analytics` `1.6.1`, montada únicamente con `NODE_ENV=production` |
| Pruebas | Vitest `4.1.x` |
| Gestor de paquetes | `pnpm` (canónico; usar el lockfile `pnpm-lock.yaml`) |

### Servicios externos por funcionalidad

| Funcionalidad | Requisito y conexión |
|---|---|
| Login, usuarios, lotes, parámetros y nodos | API Go accesible desde el servidor Next.js mediante `NEXT_PUBLIC_API_URL`: `http://localhost:8080` en desarrollo o la URL de Render en producción. |
| Actualizaciones de lotes y nodos | La misma API Go debe exponer SSE; el navegador se conecta a los handlers internos de Next.js. |
| Supervisión de video | Servidor MediaMTX con una fuente de video por Raspberry. La URL WHEP de cada cámara es un dato del dispositivo (campo `whepUrl`) y el navegador accede directamente al endpoint del nodo seleccionado. La infraestructura está pendiente de definición. |
| Login con Google (opcional) | Client ID de Google OAuth configurado para el origen del frontend y soporte del endpoint Google en la API Go. |

### MediaMTX y video

La página `/supervision` requiere que al menos un dispositivo tenga configurada
su URL WHEP de MediaMTX. Esa URL es un dato del dispositivo (campo opcional
`whepUrl`) que se administra desde `/nodos`, no una variable de entorno del
frontend. MediaMTX todavía no tiene host, puerto, path ni esquema de
autenticación definidos en este frontend; la URL acepta, por ejemplo, esta
forma:

```text
https://<host-de-mediamtx>/<path-de-stream>/whep
```

El segmento `<path-de-stream>` es solo ilustrativo; no es un path obligatorio
para este proyecto. Quedan pendientes de definir el host, el puerto, la red,
la autenticación y la URL final.

El frontend muestra **una Raspberry a la vez**. Por capacidad de las Raspberry,
cada nodo publica una sola cámara/stream: la entrada y la salida del horno son
**dos dispositivos distintos**. Las fuentes se publican en MediaMTX en
simultáneo, pero el navegador mantiene una sola sesión WHEP activa: al cambiar
de nodo libera la sesión anterior y abre la nueva. `/supervision` lista
únicamente los dispositivos con `whepUrl`; si hay más de uno, muestra un
selector segmentado de nodo, y con uno solo lo muestra como contexto.

El navegador establece una conexión WebRTC de recepción (`recvonly`) y hace
directamente un `POST` WHEP con una oferta SDP. Para que funcione en cada
despliegue, la instancia de MediaMTX debe ser alcanzable desde el navegador,
permitir el origen correspondiente mediante CORS y ser compatible con HTTPS y
la conectividad ICE de la red. No se incluye aquí una guía de instalación o
configuración de MediaMTX.

## Configuración

Las variables reconocidas por el código son:

| Variable | Uso | Requerida |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL base de la API Go. Se usa desde el servidor para server actions, páginas y handlers SSE; también es una variable pública por el prefijo `NEXT_PUBLIC_`. | Sí. Configurarla siempre, incluso cuando algunas acciones de autenticación y usuarios tienen un default de producción. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Client ID público de Google para mostrar y utilizar el login con Google. No es un client secret. | Solo para login con Google. |
| `NODE_ENV` | Controla, entre otras cosas, la analítica de producción y el atributo `Secure` de la cookie. Next.js lo establece según el modo de ejecución. | No se configura manualmente para el uso normal. |

La URL WHEP de la cámara **ya no se configura por variables de entorno**: es el
campo opcional `whepUrl` de cada dispositivo, editable desde `/nodos`. Las
variables `NEXT_PUBLIC_CAMERA_NODES`, `NEXT_PUBLIC_MEDIAMTX_WHEP_URL`,
`NEXT_PUBLIC_MEDIAMTX_WHEP_URL_ENTRADA` y `NEXT_PUBLIC_MEDIAMTX_WHEP_URL_SALIDA`
quedaron deprecadas y no se leen en el código.

Las variables `NEXT_PUBLIC_*` que usa el cliente se incorporan al bundle en el
build. Si se cambia uno de esos valores en Vercel o en otro entorno, hay que
generar un nuevo build para que el navegador reciba el valor actualizado; no
son todas variables de runtime del cliente. `NEXT_PUBLIC_API_URL` también se
lee en código de servidor, por lo que debe estar disponible en el entorno de
ejecución.

No colocar contraseñas, tokens privados ni otros secretos en variables
`NEXT_PUBLIC_*`: sus valores pueden quedar expuestos al navegador.

### Ejemplo local

Crear `.env.local` en la raíz, sin subirlo al repositorio:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

El backend local confirmado para desarrollo es `http://localhost:8080`.
La variable comentada deja deshabilitado el login Google, sin introducir
valores ficticios ni secretos. Para habilitar el video no hace falta una
variable de entorno: se configura la URL WHEP de cada cámara desde `/nodos`.

Para producción, tomar como referencia `.env.example` y definir los valores en
la configuración del proveedor. Actualmente el frontend se despliega en
Vercel y la API Go de producción en Render. El archivo `.env.example` contiene
la URL pública de Render y ejemplos no secretos para las demás variables.

### Cámaras por dispositivo

Cada dispositivo puede tener una URL WHEP opcional. El backend la expone como
`whepUrl` en `GET /api/v1/dispositivos` y la acepta como `whepUrl` opcional en
el alta y la edición. Con el dispositivo seleccionado en `/nodos` se puede
cargar o editar desde el formulario ("URL WHEP (cámara)"); la validación es
suave y sólo exige una URL `http(s)://` que termine en `/whep`.

`/supervision` construye la lista de cámaras con los dispositivos que tienen
`whepUrl` no vacío (el `dispositivoId` identifica la fuente y se preserva el
orden de la flota). Si no hay ninguna cámara configurada, muestra un estado
vacío con un acceso a `/nodos` para configurarla. Si se declaran más de una,
aparece un selector segmentado de nodo; con una sola, se muestra su nombre y
ubicación como contexto.

## Puesta en marcha local

Requisitos: Node.js compatible con Next.js 16 y `pnpm`. El proyecto no fija un
engine ni una versión exacta de Node en `package.json`; usar una versión de
Node soportada por Next.js 16 y por las dependencias instaladas.

```bash
pnpm install
pnpm dev
```

Abrir <http://localhost:3000>. Para que los datos reales estén disponibles, la
API Go debe estar accesible en `http://localhost:8080` y se debe conservar la
variable `NEXT_PUBLIC_API_URL` del ejemplo. La ejecución o instalación de
servicios externos no forma parte de este repositorio.

Comandos disponibles en `package.json`:

| Comando | Uso |
|---|---|
| `pnpm dev` | Desarrollo con `next dev` y Turbopack. |
| `pnpm build` | Build de producción con `next build`. |
| `pnpm start` | Sirve el build con `next start`. |
| `pnpm lint` | Ejecuta ESLint. |
| `pnpm test` | Ejecuta las pruebas con `vitest run`. |

## Arquitectura y flujo de datos

1. Next.js monta el layout raíz y el proveedor de tema; el layout de
   `app/(modulos)` agrega header, sidebar y footer. Las rutas de negocio están
   agrupadas en `app/(modulos)` y las de acceso en `app/(auth)`.
2. Las páginas servidor que necesitan datos llaman a server actions de
   `actions/`. Esas actions leen la cookie `session_token` y la reenvían al
   servicio Go en los requests que corresponda.
3. El servicio Go responde los datos de producción, dispositivos,
   parámetros, usuarios y autenticación. El frontend no implementa esos
   endpoints de negocio.
4. Para los eventos de lotes y nodos, el navegador abre `EventSource` contra
   rutas internas de Next (`/api/...`). Esas rutas leen la cookie y mantienen
   la conexión SSE con el endpoint equivalente de la API Go.
5. Para video, el navegador no pasa por una action de Next: negocia WHEP
   directamente con MediaMTX usando la URL `whepUrl` del dispositivo
   seleccionado en `/supervision`.
6. El proxy de Next aplica la comprobación de presencia, decodificación y
   expiración de la sesión antes de las páginas protegidas. Las APIs externas
   siguen siendo responsables de validar la sesión en cada request.

El fetch inicial de lotes, nodos y parámetros usa `cache: "no-store"`; el
dashboard y las páginas dinámicas de lotes, nodos y configuración están
marcadas como dinámicas. Las consultas de datos de esas áreas tienen un
timeout de 8 segundos para no bloquear indefinidamente cuando Render está
iniciando.

## Páginas frontend

| Ruta | Descripción |
|---|---|
| `/` | Dashboard operativo: métricas calculadas de los lotes, accesos a módulos y estado general. |
| `/login` | Inicio de sesión con email/contraseña o Google, según la configuración disponible. |
| `/unauthorized` | Pantalla mostrada cuando el rol no alcanza la regla de acceso aplicada. |
| `/usuarios` | Administración de usuarios, roles y estado activo. |
| `/lotes` | Lotes y datos históricos con filtros locales, KPIs y tabla de supervisión. |
| `/configuracion?productoId=<id>` | Parámetros de un producto e historial de corridas. Sin `productoId` se muestra el selector. |
| `/alertas` | Placeholder funcional del módulo de alertas. |
| `/supervision` | Lista los dispositivos con cámara (`whepUrl`), permite cambiar de nodo y transmite en vivo por WHEP/WebRTC con estado de reconexión. |
| `/nodos` | Estado de dispositivos, telemetría SSE, métricas históricas, operaciones CRUD de nodos y la URL WHEP de la cámara. |

La navegación lateral agrupa estas páginas en **Operación** y **Sistema**.

El proxy puede generar `/login?callbackUrl=<ruta-original>` conservando el
path y la query originales. El formulario valida ese destino para aceptar solo
rutas internas y lo utiliza después de un login local o de Google; ante un
destino ausente o inseguro redirige a `/`.

## API consumida

La base de las rutas de la API Go es `NEXT_PUBLIC_API_URL`. Las siguientes
son las rutas que el frontend consume actualmente; no representan una
especificación completa del backend.

### API Go externa

| Método y ruta | Uso desde el frontend | Queries / cuerpo relevante |
|---|---|---|
| `POST /api/v1/auth/login` | Login local. | JSON `{ email, password }`. |
| `POST /api/v1/auth/google` | Login con Google. | JSON `{ googleToken }`. |
| `POST /api/v1/auth/logout` | Cierre de sesión. | Sin cuerpo relevante. |
| `GET /api/v1/lotes-productivos` | Dashboard y `/lotes`. | `page=1&pageSize=100`. |
| `GET /api/v1/lotes-productivos` | Historial de `/configuracion`. | `productoId`, `page`, `pageSize`; la página actual solicita `page=1&pageSize=100`. |
| `GET /api/v1/dispositivos` | Carga inicial de `/nodos` y fuentes de `/supervision`. | Sin query. Cada dispositivo puede incluir `whepUrl` (opcional). |
| `GET /api/v1/dispositivos/metricas` | Historial del nodo seleccionado. | `dispositivoId`, `page`, `pageSize`; el valor por defecto de la action es `page=1&pageSize=20`. |
| `POST /api/v1/dispositivos` | Alta de un nodo Raspberry Pi. | JSON del dispositivo con `nombre`, `ubicacion` y `whepUrl` opcional; el backend genera el identificador. |
| `PUT /api/v1/dispositivos` | Actualización del nombre/ubicación y de la cámara de un nodo. | JSON con `dispositivoId`, `nombre`, `ubicacion` y `whepUrl` opcional. |
| `DELETE /api/v1/dispositivos` | Baja de un nodo. | `dispositivoId` como query. |
| `GET /api/v1/parametros-producto` | Listado de productos y parámetros recomendados. | Sin query relevante. |
| `PUT /api/v1/parametros-producto` | Actualización de parámetros de un producto. | JSON completo con `productoId`, temperaturas, velocidades, peso y tolerancias. |
| `GET /api/v1/admin/usuarios` | Listado de usuarios en `/usuarios`. | Sin query relevante. |
| `POST /api/v1/admin/usuarios` | Alta de usuario corporativo. | JSON con `email`, `nombre`, `rol` y `password` opcional. |
| `PATCH /api/v1/admin/usuarios/{id}` | Cambio de nombre, rol o estado. | JSON con `nombre`, `rol` y/o `activo`. |
| `GET /api/v1/lotes-productivos/events` | SSE de nuevos lotes. | `Accept: text/event-stream`. |
| `GET /api/v1/dispositivos/events` | SSE de estado y métricas de dispositivos. | `Accept: text/event-stream`. |

Las server actions y los handlers envían la cookie `session_token` al backend
cuando existe. Los detalles de validación, persistencia y autorización de la
API Go pertenecen al backend.

### Handlers internos de Next.js

Estas rutas sí pertenecen a este repositorio y funcionan como una capa interna
para conservar la cookie de sesión al abrir streams desde el navegador:

| Método y ruta interna | Reenvía a |
|---|---|
| `GET /api/lotes/events` | `GET /api/v1/lotes-productivos/events` |
| `GET /api/nodos/events` | `GET /api/v1/dispositivos/events` |
| `GET /api/nodos/snapshot` | `GET /api/v1/dispositivos` |

### Sesiones WHEP de MediaMTX

`components/supervision/live-camera.tsx` realiza el siguiente intercambio
directamente desde el browser, usando la URL WHEP de la cámara del nodo
seleccionado (campo `whepUrl` del dispositivo):

1. `POST <whepUrl>` con `Content-Type: application/sdp`
   y una oferta SDP de video `recvonly`.
2. Usa la respuesta SDP como answer y conserva el header `Location` de la
   sesión, cuando MediaMTX lo devuelve.
3. Al desmontar, fallar, reconectar o cambiar de nodo, hace `DELETE <Location>`
   para liberar la sesión WHEP. La URL final de MediaMTX, red, CORS y
   autenticación todavía están pendientes de definición.

## Autenticación y autorización

- La sesión del navegador se guarda en la cookie `session_token`, `HttpOnly`,
  `SameSite=Strict`, con `Secure` en producción y duración local configurada
  para ocho horas al recibir la cookie del backend.
- `/login` y `/unauthorized` son las rutas públicas. Las demás páginas pasan
  por `proxy.ts`, que redirige a `/login` si no hay cookie, el payload no se
  puede leer o la sesión está vencida.
- El frontend decodifica el payload del token para conocer `email`, `nombre`,
  `rol` y `exp`, pero **no verifica criptográficamente su firma**. La API Go
  debe rechazar tokens falsos en cada request.
- La regla configurada para `/usuarios` exige como mínimo el rol
  `Administrador`.
- La ruta `/supervision` exige como mínimo el rol `Supervisor`; también puede
  acceder `Administrador`.
- En `/configuracion`, la interfaz deja editar parámetros a `Supervisor` y
  `Administrador`; los demás roles los ven en modo lectura. Las operaciones
  sobre usuarios se realizan mediante las actions administrativas y el
  backend.

## Disponibilidad y tiempo real

Las consultas de datos dependen de la disponibilidad de la API Go. Las server
actions propagan los errores de configuración, autenticación, red, timeout y
respuestas inválidas para que cada página los presente junto con el estado sin
datos cuando corresponda:

| Función | Comportamiento ante falta de API, timeout o error |
|---|---|
| `/` y `/lotes` | `getAllProductionRuns()` propaga el error; la página informa que la consulta no está disponible. |
| `/configuracion` listado de productos | `getProductosConParametros()` propaga el error; una respuesta `data: []` se conserva como resultado vacío válido. |
| `/configuracion` historial por producto | `getLotesPorProducto()` propaga el error y conserva los metadatos de paginación; una lista vacía es válida. |
| `/nodos` | `getDevices()` propaga el error y la página informa que los dispositivos no están disponibles. |
| Historial de telemetría | `getDeviceHistory()` propaga el error e informa que el historial no está disponible. |
| Usuarios y autenticación | Devuelven un error de conexión o de autenticación. Algunas actions tienen la URL pública de Render como default, pero se recomienda configurar siempre `NEXT_PUBLIC_API_URL`. |
| Video | Se listan los dispositivos con `whepUrl`; el nodo con la cámara seleccionada se conecta y, ante una falla, intenta reconectar. Sin ninguna cámara configurada se muestra un estado vacío con acceso a `/nodos`. |

Los streams SSE de lotes y nodos se conectan desde el cliente y el navegador
puede reintentarlos. Los nodos además hacen un snapshot inicial y una
reconciliación periódica. Un cold start del backend en Render puede demorar la
primera respuesta o dejar el stream reconectando; las consultas tienen un
timeout de 8 segundos y exponen el error si se agota.

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| `NEXT_PUBLIC_API_URL no está definida` | Crear `.env.local` con `NEXT_PUBLIC_API_URL=http://localhost:8080` y reiniciar el servidor de desarrollo. |
| Dashboard sin datos o con error | Verificar que la API esté disponible, que la URL sea correcta y que la sesión tenga acceso. En Render también puede tratarse de un cold start. |
| Nodos vacíos o sin historial | Revisar la API Go, la cookie de sesión y los endpoints de dispositivos/metricas. |
| La vista de video dice “Configuración pendiente” | Verificar que la URL WHEP del dispositivo esté cargada y sea correcta. Se edita desde `/nodos`; después, comprobar alcance desde el navegador, HTTPS, CORS e ICE. |
| No aparece el selector de Raspberry | Revisar que haya más de un dispositivo con `whepUrl` cargado desde `/nodos`. Con un solo nodo se muestra como contexto, sin selector. |
| La cámara de un nodo no aparece en `/supervision` | Confirmar que el dispositivo tenga el campo `whepUrl` no vacío (el formulario valida que sea `http(s)://` y termine en `/whep`). |
| WHEP responde pero no hay video | Revisar la URL final de WHEP, la conectividad ICE y que el endpoint devuelva SDP y, si corresponde, `Location`. La configuración de red y autenticación de MediaMTX está pendiente. |
| Login Google no aparece o falla | Definir el `NEXT_PUBLIC_GOOGLE_CLIENT_ID` público correspondiente y reconstruir. El login local no depende de esa variable. |
| Se cambió una variable en Vercel pero el cliente conserva el valor anterior | Las variables `NEXT_PUBLIC_*` del cliente se inlinéan en build: hacer un nuevo deploy/build, no solo reiniciar. |
| Redirección inesperada a login o unauthorized | Revisar `session_token`, su expiración y el rol contenido en el payload. `/supervision` requiere `Supervisor` o `Administrador`. |

## Despliegue

### Frontend en Vercel

1. Configurar el proyecto Next.js desde este repositorio.
2. Definir en Vercel `NEXT_PUBLIC_API_URL` apuntando al backend Go de Render.
3. Definir opcionalmente el Client ID de Google. La URL WHEP de cada cámara se
   carga por dispositivo desde `/nodos`, no como variable de entorno.
4. Ejecutar un nuevo build/deploy cada vez que cambie una variable
   `NEXT_PUBLIC_*` que consuma el cliente.

El proyecto usa `output: "standalone"` y `images.unoptimized: true` en
`next.config.mjs`. No depende de una configuración `tailwind.config.*`.

### Backend en Render

El frontend espera que la API Go de producción esté publicada en Render y se
referencia mediante `NEXT_PUBLIC_API_URL`. La configuración del servicio Go,
su base de datos y sus variables propias están fuera de este repositorio. El
backend puede entrar en cold start: las consultas tienen timeout y los streams
SSE intentan reconectarse.

## Estructura del proyecto

```text
app/
├── (auth)/                  Login y pantalla de no autorizado
├── (modulos)/               Dashboard y páginas de operación/sistema
├── api/                     Handlers internos de SSE y snapshot de nodos
├── globals.css              Tokens y estilos Tailwind v4
└── layout.tsx               Layout raíz, metadata, tema y Analytics
actions/
├── api.ts                   Server actions para lotes, nodos y parámetros
├── auth.ts                  Server actions de login y logout
└── users.ts                 Server actions administrativas de usuarios
components/                  UI por módulo y primitivas shadcn/ui
lib/                         Tipos, formateadores, auth y utilidades
proxy.ts                     Protección de rutas y headers de sesión
public/                      Recursos estáticos
next.config.mjs              Configuración standalone e imágenes sin optimizar
package.json                 Scripts y dependencias
.env.example                 Referencia de variables sin secretos
```

La interfaz usa español con locale `es-AR`; el alias de imports `@/*` apunta a
la raíz del proyecto. Uso interno — Fermar S.A.
