# Recordatorios / deuda técnica

## Endpoints de control ya implementados en el backend Go

`GET /api/v1/lotes/{id}/control/estado` (`getControlEstado()` → CTA «Iniciar control» en `/lotes`) y
`GET /api/v1/lotes/{id}/confianza-clases` (`getConfianzaClases()` → panel «Confianza del modelo de
visión» en `ControlCard`) ya están en la UI y el backend los expone. El cliente sigue tolerando
404/timeout degradando a `null`/`[]` para un lote desconocido o un backend frío.

## Raspberry → Backend: cambio de modo

- La Pi empuja el modo con `PUT /api/v1/lotes/{id}/modo` (Bearer de dispositivo, `backend/control/cliente.py`).
- El backend ahora acepta `PATCH` (panel, cookie JWT Supervisor/Admin) y `PUT` (dispositivo, validando que la Pi pertenezca al sector del lote).
- Verificar en producción que el `PUT` de la Pi persiste el modo y que el loop se reinicia con el modo nuevo.
