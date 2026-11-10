import { describe, expect, it } from "vitest"
import { ALERTA_TIPO_LABELS, etiquetaTipoAlerta } from "@/lib/alertas"

describe("etiquetaTipoAlerta", () => {
  it("devuelve la etiqueta amigable para los tipos conocidos", () => {
    expect(etiquetaTipoAlerta("TEMPERATURA_HORNO")).toBe("Temperatura de horno")
    expect(etiquetaTipoAlerta("PRECALENTAMIENTO_TIMEOUT")).toBe(
      "Precalentamiento agotado",
    )
    expect(etiquetaTipoAlerta("PORCENTAJE_QUEMADOS_ALTO")).toBe(
      "Alto porcentaje de quemados",
    )
    expect(etiquetaTipoAlerta("PORCENTAJE_CRUDOS_ALTO")).toBe(
      "Alto porcentaje de crudos",
    )
    expect(etiquetaTipoAlerta("DISPOSITIVO_OFFLINE")).toBe("Dispositivo offline")
    expect(etiquetaTipoAlerta("TELEMETRIA_DESACTUALIZADA")).toBe(
      "Telemetría desactualizada",
    )
  })

  it("falla gracefulmente reemplazando guiones bajos por espacios", () => {
    expect(etiquetaTipoAlerta("NUEVO_TIPO_DESCONOCIDO")).toBe(
      "NUEVO TIPO DESCONOCIDO",
    )
  })

  it("devuelve el tipo crudo cuando el string está vacío", () => {
    expect(etiquetaTipoAlerta("")).toBe("")
  })

  it("tiene exactamente los seis tipos esperados", () => {
    expect(Object.keys(ALERTA_TIPO_LABELS)).toHaveLength(6)
  })
})
