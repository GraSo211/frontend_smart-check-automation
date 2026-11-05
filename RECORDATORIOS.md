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
  cuando no hay un lote abierto en el sector o cuando el lote no está en
  `MANUAL`. El selector de lote sólo muestra el lote abierto del sector.
  Cubierto por `components/horno/__tests__/consigna-form.test.tsx` y
  `lib/__tests__/consigna-validation.test.ts`.
- **Documentación de instalación**: `MANUAL_INSTALACION.md` cubre requisitos,
  variables de entorno, ejecución y despliegue. La sección de verificación de
  `/horno/consigna` fue removida; esa cobertura vive en los tests de la tarjeta
  y del formulario.
- **Telemetría real en `/horno/consigna`**: `GET /api/v1/horno` ahora proyecta
  `metricas_horno` en `HornoEstado`; la tarjeta muestra T1, velocidad de cinta,
  temperatura de combustión, humedades, objetivos y confianza, con estados
  `SIN_LOTE`, `SIN_TELEMETRIA`, `SIN_DATOS`, `DESACTUALIZADO` y `CONTROL_MANUAL`.
  El copy de consigna manual ya no habla de "horno simulado".
- **KPIs reales en el home**: el dashboard ya no muestra "ahorro potencial" ni
  un impacto estimado fijo del 15%. Ahora consulta `getAlertas(ACTIVA)` para
  el conteo de alertas activas y `getHornoEstado` por sector con lote abierto
  para el promedio de temperatura. La merma se presenta como dato observado
  (unidades y tasa) sin proyección económica ni constantes inventadas.
- **Estados del historial de consignas**: el badge de resultado ahora distingue
  `Pendiente`/`Aplicada`/`Rechazada` usando el campo `estado`, muestra los
  primeros 8 caracteres del `decisionId` bajo el badge, y conserva `exitosa`
  como fallback para backends que todavía no envíen `estado`. Cubierto por
  `components/horno/__tests__/consigna-historial.test.tsx`.

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
  (aviso de bloqueo, campos deshabilitados, selector con el lote abierto) y del
  `ControlCard` (sin propuesta / pendiente / aprobada esperando a la Pi) están
  cubiertos con tests jsdom y unitarios, pero falta revisarlos en un navegador
  con backend y Raspberry reales.
- **MediaMTX**: la URL final, la red, CORS y la autenticación del servidor de
  video siguen pendientes de definición (ver `README.md`, sección de video).
