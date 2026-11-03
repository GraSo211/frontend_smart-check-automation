# Recordatorios / deuda técnica

## Resuelto recientemente

- **Aprobación de propuesta del MPC**: el botón «Aprobar propuesta pendiente» de
  `components/lotes/control-card.tsx` sólo se habilita cuando existe una
  propuesta pendiente y `autorizada !== true`; el botón «Confirmar aprobación»
  del modal aplica el mismo control. La propuesta es única por lote, no una cola.
  Cubierto por `components/lotes/__tests__/control-card-modo.test.tsx`.
- **Refresco y limpieza de la propuesta**: en modo `SUPERVISION` la tarjeta
  consulta `GET /api/v1/lotes/{id}/consigna-propuesta` al montar y cada 10 s; un
  204 limpia el estado (la Pi ya la aplicó) y el evento SSE `control.propuesta`
  también actualiza la propuesta.
- **Bloqueo de consigna manual por modo**: `/horno/consigna` bloquea el envío
  cuando el lote está en `SUPERVISION` o `AUTOMATICO`, y también con «Sin lote»
  si hay un lote abierto automático, manteniendo habilitado el selector de lote.
  Cubierto por `components/horno/__tests__/consigna-form.test.tsx` y
  `lib/__tests__/consigna-validation.test.ts`.
- **Documentación de instalación**: `MANUAL_INSTALACION.md` cubre requisitos,
  variables (incluida `HORNO_ID`), ejecución, despliegue y la verificación
  funcional de `/horno/consigna`.

## Endpoints de control ya implementados en el backend Go

`GET /api/v1/lotes/{id}/control/estado` (`getControlEstado()` → CTA «Iniciar control» en `/lotes`) y
`GET /api/v1/lotes/{id}/confianza-clases` (`getConfianzaClases()` → panel «Confianza del modelo de
visión» en `ControlCard`) ya están en la UI y el backend los expone. El cliente sigue tolerando
404/timeout degradando a `null`/`[]` para un lote desconocido o un backend frío.

## Raspberry → Backend: cambio de modo

- La Pi empuja el modo con `PUT /api/v1/lotes/{id}/modo` (Bearer de dispositivo, `backend/control/cliente.py`).
- El backend ahora acepta `PATCH` (panel, cookie JWT Supervisor/Admin) y `PUT` (dispositivo, validando que la Pi pertenezca al sector del lote).
- Verificar en producción que el `PUT` de la Pi persiste el modo y que el loop se reinicia con el modo nuevo.

## Pendientes

- **Verificación visual en navegador real**: los estados de `/horno/consigna`
  (aviso de bloqueo, campos deshabilitados, selector de lote habilitado) y del
  `ControlCard` (sin propuesta / pendiente / aprobada esperando a la Pi) están
  cubiertos con tests jsdom y unitarios, pero falta revisarlos en un navegador
  con backend y Raspberry reales.
- **MediaMTX**: la URL final, la red, CORS y la autenticación del servidor de
  video siguen pendientes de definición (ver `README.md`, sección de video).
- **Tabla de API consumida del `README.md`**: sigue incompleta. Faltan las rutas
  de control de lote (`POST /control/start`, `POST /control/stop`,
  `GET /control/estado`, `PATCH /control/parametros`, `GET /decisiones`,
  `GET /metricas-horno`, `GET /confianza-clases`, `GET /consigna-propuesta`,
  `POST /aplicar-consigna`, `PATCH /modo`), `GET /api/v1/productos` y el SSE
  externo `GET /api/v1/lotes/{id}/control/events`.
