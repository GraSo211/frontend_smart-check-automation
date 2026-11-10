# Manual de instalación y despliegue

Guía para instalar, configurar, ejecutar y desplegar el frontend de
**SmartCheck Automation** (Next.js 16, App Router).

Este repositorio contiene **solo el frontend**. La API de negocio es un servicio
externo en Go; sin ese backend el panel no muestra datos. El frontend no
implementa endpoints de negocio: las server actions y los handlers internos
reenvían la sesión al backend.

---

## 1. Requisitos

| Requisito | Detalle |
|---|---|
| Node.js | Una versión soportada por Next.js 16. `package.json` **no fija** `engines` ni una versión exacta; se recomienda **Node 22 LTS**. |
| pnpm | El repo fija `packageManager: pnpm@11.26.0`. Usar pnpm; hay `pnpm-lock.yaml`. No usar npm ni yarn. |
| Git | Para clonar el repositorio. |
| Backend Go | Necesario para login y datos. En desarrollo, `http://localhost:8080` (o la URL de Render). |
| MediaMTX | Solo si se usa `/supervision`. Debe ser alcanzable desde el navegador. |

Activar la versión de pnpm fijada por el repo con Corepack:

```bash
corepack enable
pnpm --version   # debe informar 11.26.0
```

> El proyecto no trae un `.nvmrc` ni un campo `engines`. Si aparece un error de
> versión de Node al instalar o compilar, cambiá a Node 22 LTS.

---

## 2. Instalación

```bash
git clone <url-del-repositorio>
cd frontend_smart-check-automation
pnpm install
```

Crear la configuración local a partir de la plantilla:

```bash
cp .env.example .env.local
```

Luego editar `.env.local` con los valores reales (ver sección 3).

- `.env.local` **no se versiona**: `.gitignore` ignora `.env` y `.env*.local`.
- `.env.example` sí se versiona porque no contiene secretos.
- No ejecutar `npm install` ni `yarn install`: generan otro lockfile y pueden
  resolver versiones distintas a las fijadas.

### Variables `NEXT_PUBLIC_*` y el build

Las variables con prefijo `NEXT_PUBLIC_` que consume el cliente se **inlinéan en
el bundle durante el build**. Si cambiás una de ellas, hay que reiniciar el
servidor de desarrollo o generar un nuevo build/deploy; no alcanza con
reiniciar un proceso ya compilado.

`NEXT_PUBLIC_API_URL` además se lee en código de servidor (server actions y
handlers), por lo que debe estar disponible también en el entorno de ejecución.

**No colocar secretos en variables `NEXT_PUBLIC_*`**: sus valores pueden quedar
expuestos al navegador.

---

## 3. Variables de entorno

| Variable | Obligatoria | Uso |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Sí | URL base de la API Go, sin path final. En desarrollo `http://localhost:8080`; en producción, la URL del servicio en Render. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Solo para login con Google | Client ID **público** de Google OAuth. No es un client secret. |
| `NEXT_PUBLIC_MEDIAMTX_URL` | Solo para `/supervision` | Base pública de MediaMTX, sin path final. Si no hay un proxy delante, incluir el puerto WHEP (por defecto `8889`). |
| `JWT_SECRET` | Sí | Secreto de firma del JWT interno; debe coincidir con el `JWT_SECRET` del backend Go. Se usa en el servidor (`proxy.ts` y server components) para verificar la cookie de sesión. No usar el prefijo `NEXT_PUBLIC_`. |

`NODE_ENV` lo establece Next.js según el modo de ejecución; no se configura a
mano para el uso normal.

`JWT_SECRET` debe estar definida en el entorno donde corre Next.js (build y
runtime) y coincidir con la del backend. Si falta, el proxy falla en vez de
aceptar sesiones sin verificar.

`next.config.mjs` agrega headers de seguridad base: `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS y una CSP
mínima (`frame-ancestors`, `base-uri`, `form-action`).

Ejemplo de `.env.local` para desarrollo:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=
# NEXT_PUBLIC_MEDIAMTX_URL=https://mediamtx.example.com:8889
JWT_SECRET=your-jwt-signing-secret-minimum-32-characters
```

Con `NEXT_PUBLIC_GOOGLE_CLIENT_ID` comentada, el login con Google queda
deshabilitado y se usa email/contraseña.

### Variables deprecadas

`NEXT_PUBLIC_CAMERA_NODES`, `NEXT_PUBLIC_MEDIAMTX_WHEP_URL`,
`NEXT_PUBLIC_MEDIAMTX_WHEP_URL_ENTRADA` y
`NEXT_PUBLIC_MEDIAMTX_WHEP_URL_SALIDA` **ya no se leen**. La URL WHEP se deriva
del nombre y el tipo del dispositivo (ver sección 4).

---

## 4. Backend Go y MediaMTX

### Backend Go

El frontend consume la API Go mediante `NEXT_PUBLIC_API_URL`. Para desarrollo
local, la API debe escuchar en `http://localhost:8080`.

La API debe permitir el origen del frontend por CORS. En el backend, la variable
`FRONTEND_ORIGINS` define los orígenes permitidos separados por coma; para el
frontend local:

```env
FRONTEND_ORIGINS=http://localhost:3000
```

Si el frontend corre en otro puerto u origen, agregalo a `FRONTEND_ORIGINS`
(por ejemplo `http://localhost:3001`) y, si usás Google, registrá ese origen en
la consola de OAuth.

El backend es el responsable de validar la sesión en cada request. El frontend
también verifica la cookie `session_token` con `lib/auth.ts`: firma HS256 con
`JWT_SECRET`, issuer `smart-check-automation` y expiración (`exp` obligatorio).
Un token que no verifica se trata como sesión ausente.

### MediaMTX (video)

`/supervision` necesita `NEXT_PUBLIC_MEDIAMTX_URL` y al menos un dispositivo con
tipo `ENTRADA_HORNO` o `SALIDA_HORNO`. La URL WHEP se deriva en el frontend:

```text
<NEXT_PUBLIC_MEDIAMTX_URL>/<slug(nombre)>-<entrada|salida>/whep
```

Ejemplo: dispositivo `RB-1` de tipo `ENTRADA_HORNO` →
`https://mediamtx.example.com:8889/rb-1-entrada/whep`.

- El `slug` pasa el nombre a minúsculas, quita acentos y reemplaza secuencias no
  alfanuméricas por guiones.
- La URL **no se edita** desde `/dispositivos`; el backend puede seguir enviando
  `whepUrl`, pero el front lo ignora.
- **Entrada y salida del horno son dos dispositivos distintos**: cada Raspberry
  publica una sola cámara/stream. La Raspberry publica al mismo path por RTSP.
- El navegador negocia WHEP directamente contra MediaMTX (sin pasar por Next).
  MediaMTX debe ser alcanzable desde el navegador, permitir CORS para el origen
  del frontend y ser compatible con HTTPS e ICE.

---

## 5. Ejecución

### Desarrollo

```bash
pnpm dev
```

Abre <http://localhost:3000>. Next 16 usa **Turbopack** por defecto en `dev`.

Si el puerto 3000 está ocupado:

```bash
pnpm dev -- -p 3001
```

En ese caso actualizá `FRONTEND_ORIGINS` en el backend y el origen de Google.

### Build de producción

```bash
pnpm build
pnpm start
```

`pnpm start` sirve el build en <http://localhost:3000> por defecto.

### Comandos del repositorio

| Comando | Qué hace |
|---|---|
| `pnpm dev` | `next dev` con Turbopack. |
| `pnpm build` | `next build`. |
| `pnpm start` | `next start` sobre el build. |
| `pnpm lint` | `eslint .`. |
| `pnpm test` | `vitest run`. |
| `pnpm exec tsc --noEmit` | Chequeo de tipos puntual (no hay script `tsc`). |

### Configuración de Next

`next.config.mjs` define:

```js
output: "standalone"
images: { unoptimized: true }
```

- `output: "standalone"` genera una salida autocontenida en `.next/standalone`
  para autohospedaje.
- `images.unoptimized: true` desactiva la optimización de imágenes.
- El `next.config.mjs` actual **no** define `typescript.ignoreBuildErrors`, por
  lo que `pnpm build` verifica tipos. Ante un error de tipos, corregilo o
  ejecutá `pnpm exec tsc --noEmit` para verlo aislado.

---

## 6. Login y roles

- La sesión se guarda en la cookie `session_token` (`HttpOnly`,
  `SameSite=Strict`, `Secure` en producción).
- El login puede ser con **credenciales locales** (`POST /api/v1/auth/login`) o
  con **Google** (`POST /api/v1/auth/google`), siempre validado por el backend.
- `/login`, `/unauthorized` e `/inicio` son las rutas públicas. Un acceso anónimo
  a `/` reescribe a `/inicio`; el resto pasa por `proxy.ts`, que redirige a
  `/login` si falta la cookie o la sesión no es válida.
- Roles: `Administrador`, `Supervisor`, `Operario`.
  - `/usuarios` y `/configuracion/notificaciones` requieren `Administrador`.
  - `/supervision` y `/sectores` requieren `Supervisor` o superior.
- Si el rol no alcanza, el proxy redirige a `/unauthorized`.
- Los canales de notificación (email con Resend o Gmail API, y Telegram) se
  configuran en el backend; el frontend no necesita variables nuevas. Los
  secretos (`RESEND_API_KEY`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
  `GMAIL_REFRESH_TOKEN`, `NOTIFICACIONES_EMAIL_FROM`, `TELEGRAM_BOT_TOKEN`) y la
  elección del proveedor (`NOTIFICACIONES_EMAIL_PROVIDER`) viven solo en el
  servidor.

Sin backend no hay login ni datos: las pantallas muestran error o estado vacío.

---

## 7. Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| `NEXT_PUBLIC_API_URL no está definida` | Crear `.env.local` con `NEXT_PUBLIC_API_URL=http://localhost:8080` y reiniciar `pnpm dev`. |
| El panel no carga datos / error de conexión | Backend caído, URL incorrecta o CORS. Verificar que `FRONTEND_ORIGINS` incluya el origen exacto del front. |
| Timeout o primera carga lenta en producción | Cold start de Render. Reintentar; las consultas cortan a los 8 s. |
| `401` o redirección a `/login` | Cookie `session_token` ausente, vencida o inválida. Volver a iniciar sesión; el frontend verifica firma, issuer y expiración, y el backend valida la sesión en cada request. |
| Redirección a `/unauthorized` | Rol insuficiente para `/usuarios`, `/configuracion/notificaciones`, `/supervision` o `/sectores`. |
| Un canal de notificaciones figura «Sin configurar» | Falta configurar ese proveedor en el backend. El frontend solo muestra el estado: definí `NOTIFICACIONES_EMAIL_PROVIDER` y las variables del email (`RESEND_API_KEY` o `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`/`GMAIL_REFRESH_TOKEN`, más `NOTIFICACIONES_EMAIL_FROM`) para email, o `TELEGRAM_BOT_TOKEN` para Telegram. |
| Cambié una variable y el cliente usa el valor viejo | Las `NEXT_PUBLIC_*` se inlinéan en build: hacer un nuevo build/deploy, no solo reiniciar. |
| `/supervision` muestra "Sin cámaras disponibles" | Falta `NEXT_PUBLIC_MEDIAMTX_URL` o los dispositivos no tienen tipo `ENTRADA_HORNO`/`SALIDA_HORNO`. |
| WHEP responde pero no hay video | Revisar la URL derivada, CORS de MediaMTX, HTTPS e ICE. El path debe coincidir con el que publica la Raspberry. |
| `pnpm: command not found` o versión incorrecta | `corepack enable` y verificar `pnpm --version` (11.26.0). No usar npm/yarn. |
| Error de versión de Node al instalar/compilar | Cambiar a Node 22 LTS (el repo no fija versión). |
| `EADDRINUSE` en el puerto 3000 | Usar `pnpm dev -- -p 3001` y actualizar `FRONTEND_ORIGINS` y el origen de Google. |
| Fallan los tests | `pnpm test` usa Vitest. El entorno por defecto es `node`; los tests de componentes declaran `// @vitest-environment jsdom`. Verificar que `jsdom` esté instalado por `pnpm install`. |
| `pnpm build` falla por tipos | El build verifica tipos porque `next.config.mjs` no los ignora. Ejecutar `pnpm exec tsc --noEmit` para el detalle. |
