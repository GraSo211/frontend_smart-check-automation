# KPI de impacto económico por mermas

1. Reiniciar el backend actualizado para aplicar la migración de costos.
2. En `/configuracion`, seleccionar una variedad y cargar el **Costo unitario
   de fabricación**, en ARS por pieza. La edición conserva los permisos
   existentes (Supervisor/Administrador). Hasta dos decimales; vacío significa
   sin configurar y cero es un costo explícito.
3. Consultar el nuevo KPI del panel consolidado (últimos 30 días en ART) o
   `/reportes`, que respeta los filtros de fecha, sector, producto y turno.

El cálculo usa piezas crudas + quemadas detectadas por IA, multiplicadas por
el costo actual de su variedad. Incluye lotes abiertos y cerrados iniciados en
el período; los abiertos pueden seguir cambiando. El panel consulta un
agregado completo, independiente del listado paginado, y se reconcilia tras
eventos de producción y cada 30 segundos.

Los importes se muestran con símbolo `$`, separadores de `es-AR`, dos
decimales y la identificación `ARS`. El desglose de reportes muestra cantidades,
costos y pérdidas por variedad. Si faltan costos o conteos, aparece una
advertencia: el importe conocido se identifica como parcial y nunca se
presenta la ausencia de datos como una pérdida total de cero. Los errores de
refresco conservan el último importe confirmado con un aviso.

La pérdida se recalcula al costo **actual**, incluso para períodos anteriores;
no es un registro histórico contable. Se conserva la semántica existente de
conteos, kg, OEE, calidad, modos de control y permisos.

## Exportaciones

- CSV y Excel CSV agregan al final `costo_fabricacion_unitario_ars`,
  `perdida_merma_ars` y `referencia_costo_merma`, conservando las posiciones de
  las columnas anteriores y dejando vacíos los importes no calculables.
- JSON incluye los campos económicos de cada lote, moneda ARS y la referencia
  `actual_producto`.
- El PDF operativo agrega una página económica con total/subtotal, cobertura,
  criterio de cálculo y desglose por producto. La cabecera económica es del
  período completo, aunque el anexo de lotes tenga su límite existente.
- El PDF de trazabilidad muestra el costo actual y la pérdida del lote.

El frontend admite respuestas de un backend anterior: los indicadores
existentes siguen funcionando y el KPI nuevo se muestra como no disponible.
Guardar un costo invalida también el panel y los reportes.

## Validación

Ejecutar `pnpm test`, `pnpm lint` y `pnpm build`. Las pruebas cubren validación
de importes, costo cero vs ausente, formulario, estados incompletos, errores de
API, cookies, refresco del panel y exportación de valores económicos.
