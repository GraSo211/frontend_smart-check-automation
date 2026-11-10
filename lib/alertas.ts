/**
 * Etiquetas legibles para los tipos de alerta emitidos por el backend.
 * Tipos desconocidos se dejan como vienen (con guiones bajos reemplazados
 * por espacios) para que un nuevo tipo del backend siga siendo visible.
 */
export const ALERTA_TIPO_LABELS: Record<string, string> = {
  TEMPERATURA_HORNO: "Temperatura de horno",
  PRECALENTAMIENTO_TIMEOUT: "Precalentamiento agotado",
  PORCENTAJE_QUEMADOS_ALTO: "Alto porcentaje de quemados",
  PORCENTAJE_CRUDOS_ALTO: "Alto porcentaje de crudos",
  DISPOSITIVO_OFFLINE: "Dispositivo offline",
  TELEMETRIA_DESACTUALIZADA: "Telemetría desactualizada",
}

export function etiquetaTipoAlerta(tipo: string): string {
  if (!tipo) return tipo
  return ALERTA_TIPO_LABELS[tipo] ?? tipo.replaceAll("_", " ")
}
