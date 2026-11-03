# Manual de instalación y despliegue

Guía para instalar, configurar, ejecutar y desplegar el frontend de
**Smart-Check Automation** (Next.js 16, App Router).

Este repositorio contiene **solo el frontend**. La API de negocio es un servicio
externo en Go; sin ese backend el panel no muestra datos. El frontend no
implementa endpoints de negocio: las server actions y los handlers internos
reenvían la sesión al backend.

Documentación relacionada: [`README.md`](README.md) (alcance, páginas y API) y
[`DESIGN.md`](DESIGN.md) (temas, tokens y estados de interacción).

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
| `HORNO_ID` | No | Identificador del horno que usa `/horno/consigna`. Default: `horno-01`. Es una variable de servidor (sin prefijo `NEXT_PUBLIC_`), no se expone al navegador. |

`NODE_ENV` lo establece Next.js según el modo de ejecución; no se configura a
mano para el uso normal.

Ejemplo de `.env.local` para desarrollo:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=
# NEXT_PUBLIC_MEDIAMTX_URL=https://mediamtx.example.com:8889
# HORNO_ID=horno-01
```

Con `NEXT_PUBLIC_GOOGLE_CLIENT_ID` comentada, el login con Google queda
deshabilitado y se usa email/contraseña. `HORNO_ID` está en `.env.example` como
entrada opcional; si se omite, la página usa `horno-01`.

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
solo decodifica el payload de la cookie para conocer `email`, `nombre`, `rol` y
`exp`; **no verifica criptográficamente la firma**.

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
- `/login` y `/unauthorized` son las únicas rutas públicas. El resto pasa por
  `proxy.ts`, que redirige a `/login` si falta la cookie, el payload no se puede
  decodificar o la sesión está vencida.
- Roles: `Administrador`, `Supervisor`, `Operario`.
  - `/usuarios` requiere `Administrador`.
  - `/supervision` y `/sectores` requieren `Supervisor` o superior.
- Si el rol no alcanza, el proxy redirige a `/unauthorized`.

Sin backend no hay login ni datos: las pantallas muestran error o estado vacío.

---

## 7. Verificación funcional: `/horno/consigna`

La página `/horno/consigna` envía una consigna manual de temperatura y velocidad
de cinta al horno, asociada a un lote. Requiere:

1. Backend Go accesible por `NEXT_PUBLIC_API_URL`.
2. Sesión válida (cualquier rol autenticado; el backend acepta
   Operario/Supervisor/Admin para esta operación).
3. `HORNO_ID` definido si el horno no es `horno-01`.

Comportamiento actual del formulario: si el lote seleccionado está en modo
`SUPERVISION` o `AUTOMATICO`, el envío de consigna manual queda **bloqueado**.
Para enviar una consigna, elegí un lote en modo `MANUAL` o cambialo a `MANUAL`
desde el control del lote (`/lotes/<id>/control`). El selector de lote sigue
habilitado durante el bloqueo; «Sin lote» también queda bloqueado si hay un
lote abierto en modo automático.

Esto es una verificación funcional posterior a la instalación, no un paso de
instalación.

---

## 8. Despliegue

### Frontend en Vercel

1. Importar este repositorio como proyecto Next.js en Vercel.
2. Definir las variables de entorno del proyecto:
   - `NEXT_PUBLIC_API_URL` → URL del backend Go en Render.
   - `NEXT_PUBLIC_MEDIAMTX_URL` → base pública de MediaMTX (si se usa video).
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` → Client ID público (opcional).
   - `HORNO_ID` → opcional, si no se usa `horno-01`.
3. Desplegar.
4. Cada vez que cambie una variable `NEXT_PUBLIC_*`, generar un **nuevo
   build/deploy**: el cliente conserva el valor inlinado en el build anterior.

No subir secretos al repositorio ni a variables `NEXT_PUBLIC_*`.

### Backend en Render

El backend Go se despliega por separado en Render y se referencia con
`NEXT_PUBLIC_API_URL`. En el servicio de Render, `FRONTEND_ORIGINS` debe incluir
el origen público del frontend en Vercel (por ejemplo
`https://<proyecto>.vercel.app`), sin path final.

Render (plan gratuito) puede entrar en cold start tras ~15 minutos de
inactividad: la primera respuesta puede demorar 30–60 s. Las consultas del
frontend tienen timeout de 8 s y muestran el error si se agota; los streams SSE
reintentan solos.

---

## 9. Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| `NEXT_PUBLIC_API_URL no está definida` | Crear `.env.local` con `NEXT_PUBLIC_API_URL=http://localhost:8080` y reiniciar `pnpm dev`. |
| El panel no carga datos / error de conexión | Backend caído, URL incorrecta o CORS. Verificar que `FRONTEND_ORIGINS` incluya el origen exacto del front. |
| Timeout o primera carga lenta en producción | Cold start de Render. Reintentar; las consultas cortan a los 8 s. |
| `401` o redirección a `/login` | Cookie `session_token` ausente, vencida o inválida. Volver a iniciar sesión; el backend valida la firma. |
| Redirección a `/unauthorized` | Rol insuficiente para `/usuarios`, `/supervision` o `/sectores`. |
| Cambié una variable y el cliente usa el valor viejo | Las `NEXT_PUBLIC_*` se inlinéan en build: hacer un nuevo build/deploy, no solo reiniciar. |
| `/supervision` muestra "Sin cámaras disponibles" | Falta `NEXT_PUBLIC_MEDIAMTX_URL` o los dispositivos no tienen tipo `ENTRADA_HORNO`/`SALIDA_HORNO`. |
| WHEP responde pero no hay video | Revisar la URL derivada, CORS de MediaMTX, HTTPS e ICE. El path debe coincidir con el que publica la Raspberry. |
| `pnpm: command not found` o versión incorrecta | `corepack enable` y verificar `pnpm --version` (11.26.0). No usar npm/yarn. |
| Error de versión de Node al instalar/compilar | Cambiar a Node 22 LTS (el repo no fija versión). |
| `EADDRINUSE` en el puerto 3000 | Usar `pnpm dev -- -p 3001` y actualizar `FRONTEND_ORIGINS` y el origen de Google. |
| Fallan los tests | `pnpm test` usa Vitest. El entorno por defecto es `node`; los tests de componentes declaran `// @vitest-environment jsdom`. Verificar que `jsdom` esté instalado por `pnpm install`. |
| `pnpm build` falla por tipos | El build verifica tipos porque `next.config.mjs` no los ignora. Ejecutar `pnpm exec tsc --noEmit` para el detalle. |

---

## 10. Estructura mínima y verificación rápida

```text
app/
├── (auth)/                  Login y no autorizado
├── (modulos)/               Dashboard y páginas de operación/sistema
│   ├── horno/consigna/      Consigna manual del horno
│   ├── supervision/         Video en vivo por WHEP
│   └── ...
├── api/                     Handlers internos: snapshot/SSE y health check
└── layout.tsx               Layout raíz
actions/
├── api.ts                   Server actions de datos y mutaciones
├── auth.ts                  Login/logout
└── users.ts                 Administración de usuarios
components/                  UI por módulo y primitivas shadcn/ui
lib/                         Tipos, auth, cliente HTTP y utilidades
proxy.ts                     Protección de rutas y headers de sesión
next.config.mjs              standalone + imágenes sin optimizar
package.json                 Scripts y dependencias
.env.example                 Plantilla de variables sin secretos
```

Verificación rápida antes de desplegar:

```bash
pnpm install
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Con el backend local corriendo en `http://localhost:8080` y `.env.local`
completo, `pnpm dev` debe permitir iniciar sesión en <http://localhost:3000> y
mostrar datos reales. Sin backend, el panel funciona pero no hay datos.
