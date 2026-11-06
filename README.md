# SmartCheck Automation

Frontend de **SmartCheck Automation** para la supervisión de producción de la
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
| Operación | Dashboard con indicadores de producción, calidad, merma observada, alertas activas, temperatura promedio real del horno, conectividad y sincronización. |
| Supervisión | Lista y muestra la cámara de los dispositivos con tipo (entrada/salida) derivando la URL WHEP a partir del nombre, el tipo y `NEXT_PUBLIC_MEDIAMTX_URL`, con reconexión automática. Por capacidad de las Raspberry, cada dispositivo expone una sola cámara/stream. |
| Lotes | Consulta de lotes, búsqueda por producto, filtro por estado y sector (en la URL), KPIs y tabla histórica. |
| Consigna manual | Envía una consigna de temperatura y velocidad de cinta al horno del sector seleccionado, asociada a un lote abierto en modo `MANUAL`, y muestra la última telemetría real de la Pi (`/horno/consigna`) y el historial de consignas. El formulario queda bloqueado si no hay un lote abierto o si el lote está en `SUPERVISION` o `AUTOMATICO`; para enviar, el lote debe estar en `MANUAL` (se cambia desde Control del lote). El historial muestra `Pendiente` (encolada), `Aplicada` (confirmada por ack de la Pi) y `Rechazada` (no se pudo encolar), junto con el `decisionId` cuando existe; `exitosa` sigue presente por compatibilidad con respuestas viejas. |
| Línea de producción | Vista por sector del lote abierto: modo de operación, setpoints contra el rango del producto, KPIs de calidad y alertas activas del sector. |
| Configuración | Selección de producto, edición de parámetros de horno/cinta/calidad y consulta del historial de corridas. La edición en la interfaz está habilitada para Supervisor y Administrador. |
| Notificaciones | Configuración de canales de alerta (Email/Resend y Telegram) y preferencias por usuario. Requiere rol Administrador. Los secretos de los proveedores se configuran únicamente en el backend. |
| Sectores | Administración de los sectores productivos: indicadores, búsqueda, alta/edición/baja y conteo de dispositivos asignados. La gestión requiere rol Supervisor o Administrador. |
| Dispositivos | Estado de Raspberry Pi, última telemetría, métricas en vivo, historial, solicitudes de registro (aprobar/rechazar), edición de sector y baja de dispositivos. La URL WHEP de la cámara se deriva del nombre y el tipo y es de solo lectura en el panel; el nombre se sincroniza con la Raspberry, que es la fuente de verdad. |
| Usuarios | Listado, búsqueda, alta, cambio de rol y activación/desactivación de usuarios corporativos. |
| Alertas | Listado de alertas operativas con filtro por estado (`ACTIVA`, `ACK`, `RESUELTA`, `TODAS`) y acuse de recibo para Supervisor y Administrador. |
| Reportes | Centro de reportes con KPIs de producción, calidad, proceso, alertas, MPC y OEE (A/P/Q). Filtros por rango de fechas (ART), sector, producto y turno; descarga del detalle en CSV, CSV para Excel es-AR, JSON y PDF operativo, alertas del período en CSV/JSON, y PDF/CSV de trazabilidad por lote con métricas, consignas, alertas y decisiones MPC. |

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
| PDF | `@react-pdf/renderer` `4.9.x` (Route Handler Node, Helvetica built-in) |
| Analítica | `@vercel/analytics` `1.6.1`, montada únicamente con `NODE_ENV=production` |
| Pruebas | Vitest `4.1.x`; entorno `node` por defecto y `jsdom` en los tests de componentes |
| Gestor de paquetes | `pnpm` (canónico; usar el lockfile `pnpm-lock.yaml`) |

### Servicios externos por funcionalidad

| Funcionalidad | Requisito y conexión |
|---|---|
| Login, usuarios, lotes, parámetros y dispositivos | API Go accesible desde el servidor Next.js mediante `NEXT_PUBLIC_API_URL`: `http://localhost:8080` en desarrollo o la URL de Render en producción. |
| Actualizaciones de lotes y dispositivos | La misma API Go debe exponer SSE; el navegador se conecta a los handlers internos de Next.js. |
| Supervisión de video | Servidor MediaMTX con una fuente de video por Raspberry. La URL WHEP de cada cámara se deriva en el front a partir del nombre del dispositivo, su tipo (entrada/salida) y `NEXT_PUBLIC_MEDIAMTX_URL`; el navegador accede directamente al endpoint del dispositivo seleccionado. La infraestructura está pendiente de definición. |
| Login con Google (opcional) | Client ID de Google OAuth configurado para el origen del frontend y soporte del endpoint Google en la API Go. |

### MediaMTX y video

La página `/supervision` requiere que al menos un dispositivo tenga tipo
(`ENTRADA_HORNO` o `SALIDA_HORNO`) y que esté definida la variable de entorno
`NEXT_PUBLIC_MEDIAMTX_URL`. La URL WHEP se deriva en el frontend como:

```text
<NEXT_PUBLIC_MEDIAMTX_URL>/<slug(nombre)>-<entrada|salida>/whep
```

Por ejemplo, un dispositivo llamado `RB-1` de tipo `ENTRADA_HORNO` genera
`https://mediamtx.example/rb-1-entrada/whep`. El path usa guiones para formar
un único segmento, igual que la publicación de la Raspberry.

El frontend muestra **una Raspberry a la vez**. Por capacidad de las Raspberry,
cada dispositivo publica una sola cámara/stream: la entrada y la salida del horno son
**dos dispositivos distintos**. Las fuentes se publican en MediaMTX en
simultáneo, pero el navegador mantiene una sola sesión WHEP activa: al cambiar
de dispositivo libera la sesión anterior y abre la nueva. `/supervision` lista
únicamente los dispositivos cuya URL pudo derivarse; si hay más de uno, muestra
un selector segmentado de dispositivo, y con uno solo lo muestra como contexto.

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
| `NEXT_PUBLIC_API_URL` | URL base de la API Go. Se usa desde el servidor para server actions, páginas y handlers SSE; también es una variable pública por el prefijo `NEXT_PUBLIC_`. | Sí. Es obligatoria para todas las actions; si falta, la action falla con un error de configuración en vez de usar un fallback. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Client ID público de Google para mostrar y utilizar el login con Google. No es un client secret. | Solo para login con Google. |
| `NEXT_PUBLIC_MEDIAMTX_URL` | Base pública del servidor MediaMTX (sin path final). El front arma la URL WHEP de cada dispositivo como `<base>/<slug(nombre)>-<entrada|salida>/whep`. | Sí, para que `/supervision` pueda reproducir video. |
| `JWT_SECRET` | Secreto de firma del JWT interno. Debe coincidir con el `JWT_SECRET` del backend Go. Se usa en el servidor (`proxy.ts` y server components) para verificar la cookie de sesión; no debe llevar prefijo `NEXT_PUBLIC_`. | Sí. |
| `NODE_ENV` | Controla, entre otras cosas, la analítica de producción y el atributo `Secure` de la cookie. Next.js lo establece según el modo de ejecución. | No se configura manualmente para el uso normal. |

`JWT_SECRET` se lee en el servidor (incluido el proxy) y debe estar definida en
el entorno de build/ejecución (por ejemplo, Vercel) con el mismo valor que el
backend Go. Si falta, el proxy falla en vez de aceptar sesiones sin verificar.

`next.config.mjs` agrega headers de seguridad base: `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS y una CSP
mínima (`frame-ancestors`, `base-uri`, `form-action`).

Las variables `NEXT_PUBLIC_CAMERA_NODES`, `NEXT_PUBLIC_MEDIAMTX_WHEP_URL`,
`NEXT_PUBLIC_MEDIAMTX_WHEP_URL_ENTRADA` y `NEXT_PUBLIC_MEDIAMTX_WHEP_URL_SALIDA`
quedaron deprecadas y no se leen en el código.

Las variables `NEXT_PUBLIC_*` que usa el cliente se incorporan al bundle en el
build. Si se cambia uno de esos valores en Vercel o en otro entorno, hay que
generar un nuevo build para que el navegador reciba el valor actualizado; no
son todas variables de runtime del cliente. `NEXT_PUBLIC_API_URL` también se
lee en código de servidor, por lo que debe estar disponible en el entorno de
ejecución.

No colocar contraseñas, tokens privados ni otros secretos en variables
`NEXT_PUBLIC_*`: sus valores pueden quedar expuestos al navegador. Las claves de
los proveedores de notificaciones (`RESEND_API_KEY`, `NOTIFICACIONES_EMAIL_FROM`,
`TELEGRAM_BOT_TOKEN`) se leen y almacenan únicamente en el backend; el frontend
solo muestra el estado de configuración y los nombres de las variables.

### Ejemplo local

Crear `.env.local` en la raíz, sin subirlo al repositorio:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=
JWT_SECRET=your-jwt-signing-secret-minimum-32-characters
```

El backend local confirmado para desarrollo es `http://localhost:8080`.
La variable comentada deja deshabilitado el login Google, sin introducir
valores ficticios ni secretos. Para habilitar el video también definí
`NEXT_PUBLIC_MEDIAMTX_URL` apuntando a la base pública de MediaMTX.

Para producción, tomar como referencia `.env.example` y definir los valores en
la configuración del proveedor. Actualmente el frontend se despliega en
Vercel y la API Go de producción en Render. El archivo `.env.example` contiene
la URL pública de Render y ejemplos no secretos para las demás variables.

### Cámaras por dispositivo

La URL WHEP de cada dispositivo se deriva en el frontend a partir de su nombre,
su tipo (`ENTRADA_HORNO` → `entrada`, `SALIDA_HORNO` → `salida`) y la variable
de entorno `NEXT_PUBLIC_MEDIAMTX_URL`. El backend puede seguir devolviendo
`whepUrl`, pero el front lo ignora: la fuente de verdad visual es la URL
derivada. No se edita desde `/dispositivos`.

`/supervision` construye la lista de cámaras con los dispositivos cuya URL se
pudo derivar (tienen tipo y existe `NEXT_PUBLIC_MEDIAMTX_URL`). El
`dispositivoId` identifica la fuente y se preserva el orden de la flota. Si no
hay ninguna cámara disponible, muestra un estado vacío con un acceso a
`/dispositivos` para revisar el tipo asignado. Si se declaran más de una,
aparece un selector segmentado de dispositivo; con una sola, se muestra su nombre y
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

La guía paso a paso de instalación, variables de entorno, despliegue y
verificación funcional está en
[`MANUAL_INSTALACION.md`](MANUAL_INSTALACION.md).

Comandos disponibles en `package.json`:

| Comando | Uso |
|---|---|
| `pnpm dev` | Desarrollo con `next dev` y Turbopack. |
| `pnpm build` | Build de producción con `next build`. |
| `pnpm start` | Sirve el build con `next start`. |
| `pnpm lint` | Ejecuta ESLint. |
| `pnpm test` | Ejecuta las pruebas con `vitest run`. |

`pnpm test` usa Vitest con entorno `node` por defecto. Las pruebas de validación
de consigna están en `lib/__tests__/consigna-validation.test.ts` y las de los
componentes de consigna en `components/horno/__tests__/consigna-form.test.tsx`,
que declara `// @vitest-environment jsdom`. Para un chequeo de tipos aislado,
ejecutá `pnpm exec tsc --noEmit`.

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
4. Para los eventos de lotes, control de lote y dispositivos, el navegador abre
   `EventSource` contra rutas internas de Next (`/api/...`). Esas rutas leen la
   cookie y mantienen la conexión SSE con el endpoint equivalente de la API Go.
5. Para video, el navegador no pasa por una action de Next: negocia WHEP
   directamente con MediaMTX usando la URL derivada del dispositivo
   seleccionado en `/supervision` (`<NEXT_PUBLIC_MEDIAMTX_URL>/<slug(nombre)>-<entrada|salida>/whep`).
6. El proxy de Next aplica la comprobación de presencia, decodificación y
   expiración de la sesión antes de las páginas protegidas. Las APIs externas
   siguen siendo responsables de validar la sesión en cada request.

El fetch inicial de lotes, dispositivos y parámetros usa `cache: "no-store"`; el
dashboard y las páginas dinámicas de lotes, control de lote, dispositivos,
configuración, consigna manual, línea de producción, alertas y reportes están
marcadas como dinámicas. Las consultas de datos de esas áreas tienen un
timeout de 8 segundos para no bloquear indefinidamente cuando Render está
iniciando.

## Páginas frontend

| Ruta | Descripción |
|---|---|
| `/` | Dashboard operativo: métricas calculadas de los lotes, merma observada (unidades y tasa), alertas activas del backend, promedio de temperatura real por sector con lote abierto, accesos a módulos y estado general. |
| `/login` | Inicio de sesión con email/contraseña o Google, según la configuración disponible. |
| `/unauthorized` | Pantalla mostrada cuando el rol no alcanza la regla de acceso aplicada. |
| `/usuarios` | Administración de usuarios, roles y estado activo. |
| `/lotes` | Lotes y datos históricos con filtros locales, KPIs y tabla de supervisión. |
| `/lotes/<id>/control` | Control automático/supervisión de un lote: modo (`MANUAL`, `SUPERVISION`, `AUTOMATICO`), Iniciar/Detener, estado del MPC, propuesta pendiente y confianza del modelo. |
| `/linea-produccion` | Vista por sector del lote abierto: modo, setpoints, KPIs de calidad y alertas activas. |
| `/horno/consigna` | Consigna manual de temperatura y velocidad de cinta para un lote abierto en modo `MANUAL`, última telemetría real de la Pi por sector/lote e historial de consignas. |
| `/configuracion?productoId=<id>` | Parámetros de un producto e historial de corridas. Sin `productoId` se muestra el selector. |
| `/configuracion/notificaciones` | Canales de notificación (Email/Resend y Telegram) y preferencias por usuario. Requiere rol Administrador. |
| `/sectores` | Gestión de sectores productivos: indicadores, búsqueda, alta/edición/baja y dispositivos asignados. Requiere rol Supervisor o Administrador. |
| `/alertas` | Alertas operativas con filtro por estado y acuse de recibo. |
| `/reportes` | Centro de reportes: resumen de KPIs y gráficos por período, OEE, filtros por sector/producto/turno, descargas CSV/Excel es-AR/JSON/PDF, alertas del período y PDF/CSV de trazabilidad por lote (métricas, alertas, decisiones y consignas). |
| `/planificacion` | Importación CSV de plan de producción y paradas para habilitar OEE; rechaza planes solapados por sector, lista lo cargado con eliminación y permite editar reimportando el CSV (upsert). Requiere Supervisor o Administrador. |
| `/supervision` | Lista los dispositivos con cámara derivada, permite cambiar de dispositivo y transmite en vivo por WHEP/WebRTC con estado de reconexión. |
| `/dispositivos` | Estado de dispositivos, telemetría SSE, métricas históricas, operaciones CRUD de dispositivos y vista de solo lectura de la URL WHEP derivada. |

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
| `GET /api/v1/sectores` | Dashboard, `/lotes`, `/sectores`, `/configuracion` y snapshot global. | Sin query. |
| `GET /api/v1/lotes` | Dashboard, `/lotes`, `/configuracion` y snapshot global. Paginación por cursor. | `sector_id` (obligatorio con OAuth), `producto_id`, `limite`, `antes_de` (cursor); el backend omite `siguiente_cursor` en la última página. |
| `GET /api/v1/lotes/abierto` | Lote abierto del sector en `/lotes`. | `sector_id`; responde `lote: null` cuando no hay ninguno. |
| `POST /api/v1/lotes/{id}/control/start` | Inicia el loop MPC del lote desde `ControlCard`. | Sin cuerpo; requiere Supervisor/Admin. |
| `POST /api/v1/lotes/{id}/control/stop` | Detiene el loop MPC del lote. | Sin cuerpo; requiere Supervisor/Admin. |
| `GET /api/v1/lotes/{id}/control/estado` | Estado runtime del loop en `ControlCard`. | Sin query; un 404 degrada a `null`. |
| `PATCH /api/v1/lotes/{id}/control/parametros` | Ajuste de parámetros del control desde `ControlCard`. | JSON parcial con los parámetros editables. |
| `PATCH /api/v1/lotes/{id}/modo` | Cambio de modo `MANUAL`/`SUPERVISION`/`AUTOMATICO`. | JSON `{ modo }`; requiere Supervisor/Admin. |
| `GET /api/v1/lotes/{id}/decisiones` | Audit del MPC en `ControlCard`. | `limite` (default 50, máximo 100). |
| `GET /api/v1/lotes/{id}/metricas-horno` | Últimas lecturas del horno para el estado actual. | `limite` (default 1, máximo 200). |
| `GET /api/v1/lotes/{id}/confianza-clases` | Confianza agregada del modelo de visión. | `limite` (default 200, máximo 2000); un 404 degrada a `[]`. |
| `GET /api/v1/lotes/{id}/consigna-propuesta` | Propuesta pendiente del MPC en `SUPERVISION`. | Sin query; `204` = sin propuesta. |
| `POST /api/v1/lotes/{id}/aplicar-consigna` | Aprueba/aplica la propuesta pendiente. | JSON opcional `{ decision_id }`; requiere propuesta no autorizada. |
| `GET /api/v1/lotes/{id}/control/events` | SSE de propuestas y cambios de modo del lote. | `Accept: text/event-stream`; eventos `control.propuesta` y `control.evento`. |
| `GET /api/v1/dispositivos` | Carga inicial de `/dispositivos`, `/sectores` y fuentes de `/supervision`. | Sin query. El front ignora el campo `whepUrl` si el backend lo envía; la URL se deriva localmente. |
| `GET /api/v1/dispositivos/metricas` | Historial del dispositivo seleccionado. | `dispositivoId`, `page`, `pageSize`; el valor por defecto de la action es `page=1&pageSize=20`. |
| `POST /api/v1/dispositivos` | **No se usa**: responde 405. El alta pasa por solicitudes de registro. | — |
| `PUT /api/v1/dispositivos` | Actualiza el sector de un dispositivo. La URL WHEP no se edita desde el panel y el backend rechaza `nombre` en este cuerpo (400). | JSON con `dispositivoId` y `sectorId`; un 409 indica rol de dispositivo duplicado en el sector. |
| `PUT /api/v1/dispositivos/{id}/nombre` | Renombra un dispositivo desde el panel (Supervisor/Administrador). La Raspberry es la fuente de verdad y también puede renombrarse por su propio endpoint. | JSON `{ nombre }`; un 404 indica que el dispositivo no existe. |
| `DELETE /api/v1/dispositivos` | Baja (soft delete) de un dispositivo. | `dispositivoId` como query. |
| `GET /api/v1/registration-requests` | Solicitudes de registro pendientes en `/dispositivos`. | Sólo Supervisor/Admin. |
| `POST /api/v1/registration-requests/{id}/approve` | Aprobar una solicitud de registro. | — |
| `POST /api/v1/registration-requests/{id}/reject` | Rechazar una solicitud de registro. | — |
| `GET /api/v1/productos` | Listado de productos y parámetros recomendados. | Sin query relevante. |
| `PUT /api/v1/productos/{id}` | Actualización de parámetros de un producto. | JSON completo con `productoId`, temperaturas, velocidades, peso y tolerancias. |
| `POST /api/v1/sectores` | Alta de sector en `/sectores`. | JSON `{ nombre }`. |
| `PUT /api/v1/sectores/{id}` | Renombrar un sector. | JSON `{ nombre }`. |
| `DELETE /api/v1/sectores/{id}` | Baja de un sector; 409 si tiene lotes asociados. | — |
| `GET /api/v1/admin/usuarios` | Listado de usuarios en `/usuarios`. | Sin query relevante. |
| `POST /api/v1/admin/usuarios` | Alta de usuario corporativo. | JSON con `email`, `nombre`, `rol` y `password` opcional. |
| `PATCH /api/v1/admin/usuarios/{id}` | Cambio de nombre, rol o estado. | JSON con `nombre`, `rol` y/o `activo`. |
| `GET /api/v1/admin/notificaciones` | Estado de canales y destinatarios de `/configuracion/notificaciones`. | Responde `canales` (email/telegram) y `destinatarios`. |
| `PATCH /api/v1/admin/notificaciones/{usuarioID}` | Actualiza chat ID de Telegram y/o toggles de email/Telegram de un usuario. | JSON opcional `{ telegram_chat_id, notificar_email, notificar_telegram }`. |
| `POST /api/v1/admin/notificaciones/test` | Envía un mensaje de prueba por el canal indicado. | JSON `{ canal: "EMAIL" \| "TELEGRAM", usuario_id }`. |
| `GET /api/v1/lotes/events` | SSE de nuevos lotes. | `Accept: text/event-stream`. |
| `GET /api/v1/dispositivos/events` | SSE de estado y métricas de dispositivos. | `Accept: text/event-stream`. |
| `GET /api/v1/horno` | Última telemetría real del horno de un sector en `/horno/consigna` (proyección de `metricas_horno`). | `sector_id` obligatorio; si el sector no existe (404), degrada a `null`. |
| `GET /api/v1/horno/consigna/historial` | Historial de consignas del lote seleccionado. | `loteId` obligatorio; un 404 degrada a lista vacía. |
| `POST /api/v1/horno/consigna` | Envío de una consigna manual al horno del sector. Requiere un lote abierto en modo `MANUAL`; el backend la encola para la Pi y la aplicación se confirma por ack en `decisiones_control`. El campo `usuario` se completa desde la sesión. | JSON `{ sectorId, productoId, temperaturaObjetivo, velocidadCintaObjetivo, loteId, usuario? }`. |
| `GET /api/v1/alertas` | Listado de alertas en `/alertas` y alertas activas de `/linea-produccion`. | `estado=ACTIVA\|ACK\|RESUELTA`; un 404 degrada a lista vacía. |
| `POST /api/v1/alertas/{id}/ack` | Acuse de recibo de una alerta. | Sin cuerpo; 409 si la alerta ya fue reconocida o resuelta. |

Las server actions y los handlers envían la cookie `session_token` al backend
cuando existe. Los detalles de validación, persistencia y autorización de la
API Go pertenecen al backend.

### Handlers internos de Next.js

Estas rutas sí pertenecen a este repositorio y funcionan como una capa interna:
conservan la cookie de sesión al abrir streams y generan descargas desde el
servidor.

| Método y ruta interna | Reenvía a |
|---|---|
| `GET /api/lotes/events` | `GET /api/v1/lotes/events` |
| `GET /api/lotes/snapshot` | `GET /api/v1/sectores` + `GET /api/v1/lotes` (recorrido por cursor de cada sector) |
| `GET /api/lotes/{id}/control/events` | `GET /api/v1/lotes/{id}/control/events` (SSE `control.propuesta` y `control.evento`) |
| `GET /api/dispositivos/events` | `GET /api/v1/dispositivos/events` |
| `GET /api/dispositivos/snapshot` | `GET /api/v1/dispositivos` |
| `GET /api/reportes/lotes` | Genera CSV/JSON/PDF a partir de `GET /api/v1/reportes/resumen` y `GET /api/v1/reportes/lotes`; el PDF se renderiza con `@react-pdf/renderer` |
| `GET /api/reportes/trazabilidad` | Genera el PDF de trazabilidad de un lote, o CSV de `dataset=proceso|alertas|decisiones|consignas`, a partir de `GET /api/v1/reportes/trazabilidad?lote_id=...` |
| `GET /api/reportes/alertas` | Genera CSV/JSON de alertas del período desde `GET /api/v1/reportes/alertas` |
| `GET /api/reportes/oee` | Consume `GET /api/v1/reportes/oee` para el bloque OEE del panel y del PDF |
| `POST /api/planificacion/[tipo]/import` | Reenvía el CSV multipart a `POST /api/v1/planificacion/{plan,paradas}/import` |
| `GET /api/planificacion/[tipo]` | Lista lo importado desde `GET /api/v1/planificacion/{plan,paradas}` |
| `DELETE /api/planificacion/[tipo]/[id]` | Elimina una fila importada vía `DELETE /api/v1/planificacion/{tipo}/{id}` |
| `GET /api/system-status` | `GET /health` |

### Sesiones WHEP de MediaMTX

`components/supervision/live-camera.tsx` realiza el siguiente intercambio
directamente desde el browser, usando la URL WHEP derivada del dispositivo
seleccionado en `/supervision`:

1. `POST <whepUrl>` con `Content-Type: application/sdp`
   y una oferta SDP de video `recvonly`.
2. Usa la respuesta SDP como answer y conserva el header `Location` de la
   sesión, cuando MediaMTX lo devuelve.
3. Al desmontar, fallar, reconectar o cambiar de dispositivo, hace `DELETE <Location>`
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
- `/horno/consigna` sólo requiere una sesión válida; el backend acepta
  Operario, Supervisor y Administrador para enviar la consigna.

## Disponibilidad y tiempo real

Las consultas de datos dependen de la disponibilidad de la API Go. Las server
actions propagan los errores de configuración, autenticación, red, timeout y
respuestas inválidas para que cada página los presente junto con el estado sin
datos cuando corresponda:

| Función | Comportamiento ante falta de API, timeout o error |
|---|---|
| `/` y `/lotes` | `getAllLotes()` propaga el error; la página informa que la consulta no está disponible. |
| `/configuracion` listado de productos | `getProductos()` propaga el error; una respuesta `data: []` se conserva como resultado vacío válido. |
| `/configuracion` historial por producto | `getLotes()` propaga el error y conserva los metadatos de paginación; una lista vacía es válida. |
| `/dispositivos` | `getDevices()` propaga el error y la página informa que los dispositivos no están disponibles. |
| `/horno/consigna` | Productos, sectores, lote abierto, estado del horno e historial se consultan por separado; el error de cada bloque se muestra sin bloquear el resto de la página. |
| Historial de telemetría | `getDeviceHistoryPage()` propaga el error e informa que el historial no está disponible. |
| Usuarios y autenticación | Devuelven un error de conexión o de autenticación. `NEXT_PUBLIC_API_URL` es obligatoria: no hay fallback a Render. |
| Video | Se listan los dispositivos cuya URL WHEP se pudo derivar; el dispositivo con la cámara seleccionada se conecta y, ante una falla, intenta reconectar. Sin ninguna cámara disponible se muestra un estado vacío con acceso a `/dispositivos`. |

Los streams SSE de lotes, control de lote y dispositivos se conectan desde el
cliente y el navegador puede reintentarlos. Los dispositivos además hacen un
snapshot inicial y una reconciliación periódica. Un cold start del backend en
Render puede demorar la primera respuesta o dejar el stream reconectando; las
consultas tienen un timeout de 8 segundos y exponen el error si se agota.

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| `NEXT_PUBLIC_API_URL no está definida` | Crear `.env.local` con `NEXT_PUBLIC_API_URL=http://localhost:8080` y reiniciar el servidor de desarrollo. |
| Dashboard sin datos o con error | Verificar que la API esté disponible, que la URL sea correcta y que la sesión tenga acceso. En Render también puede tratarse de un cold start. |
| Dispositivos vacíos o sin historial | Revisar la API Go, la cookie de sesión y los endpoints de dispositivos/metricas. |
| La vista de video dice "Sin cámaras disponibles" | Verificar que esté definida `NEXT_PUBLIC_MEDIAMTX_URL` y que los dispositivos tengan tipo (`ENTRADA_HORNO` o `SALIDA_HORNO`). La URL ya no se edita desde `/dispositivos`. |
| No aparece el selector de Raspberry | Revisar que haya más de un dispositivo con tipo asignado y URL derivada. Con un solo dispositivo se muestra como contexto, sin selector. |
| La cámara de un dispositivo no aparece en `/supervision` | Confirmar que el dispositivo tenga tipo (entrada/salida) y que `NEXT_PUBLIC_MEDIAMTX_URL` esté configurada. El path derivado debe coincidir con el que publica la Raspberry. |
| WHEP responde pero no hay video | Revisar la URL final de WHEP, la conectividad ICE y que el endpoint devuelva SDP y, si corresponde, `Location`. La configuración de red y autenticación de MediaMTX está pendiente. |
| Login Google no aparece o falla | Definir el `NEXT_PUBLIC_GOOGLE_CLIENT_ID` público correspondiente y reconstruir. El login local no depende de esa variable. |
| Se cambió una variable en Vercel pero el cliente conserva el valor anterior | Las variables `NEXT_PUBLIC_*` del cliente se inlinéan en build: hacer un nuevo deploy/build, no solo reiniciar. |
| Redirección inesperada a login o unauthorized | Revisar `session_token`, su expiración y el rol contenido en el payload. `/supervision` requiere `Supervisor` o `Administrador`. |
| El formulario de consigna manual está bloqueado | No hay un lote abierto en el sector, o el lote seleccionado está en `SUPERVISION` o `AUTOMATICO`. Abrí un lote o cambialo a `MANUAL` desde el control del lote. |

## Despliegue

### Frontend en Vercel

1. Configurar el proyecto Next.js desde este repositorio.
2. Definir en Vercel `NEXT_PUBLIC_API_URL` apuntando al backend Go de Render.
3. Definir `NEXT_PUBLIC_MEDIAMTX_URL` con la base pública de MediaMTX.
4. Definir opcionalmente el Client ID de Google.
5. Ejecutar un nuevo build/deploy cada vez que cambie una variable
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
│   └── horno/consigna/      Consigna manual del horno
├── api/                     Handlers internos: snapshot/SSE de lotes y control, dispositivos, reportes y health check
├── globals.css              Tokens y estilos Tailwind v4
└── layout.tsx               Layout raíz, metadata, tema y Analytics
actions/
├── api.ts                   Server actions para lotes, control, horno, dispositivos, alertas y parámetros
├── auth.ts                  Server actions de login y logout
├── reports.ts               Armado de reportes CSV/JSON de lotes
└── users.ts                 Server actions administrativas de usuarios
components/                  UI por módulo y primitivas shadcn/ui
├── horno/                   Panel, formulario, estado e historial de consigna manual
└── ...
lib/                         Tipos, formateadores, auth y utilidades
├── __tests__/               Pruebas unitarias, incluye consigna-validation.test.ts
└── ...
proxy.ts                     Protección de rutas y headers de sesión
public/                      Recursos estáticos
next.config.mjs              Configuración standalone e imágenes sin optimizar
package.json                 Scripts y dependencias
.env.example                 Referencia de variables sin secretos
```

La interfaz usa español con locale `es-AR`; el alias de imports `@/*` apunta a
la raíz del proyecto. Uso interno — Fermar S.A.
