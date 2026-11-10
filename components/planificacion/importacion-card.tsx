"use client"

import { useRef, useState } from "react"
import { Download, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  buildCsvTemplate,
  buildImportUrl,
  type TipoImportacion,
} from "@/lib/planificacion"

interface ImportacionResultado {
  procesadas: number
  insertadas: number
  actualizadas: number
  errores: { fila: number; mensaje: string }[]
}

interface ImportacionCardProps {
  tipo: TipoImportacion
  title: string
  description: string
}

export function ImportacionCard({
  tipo,
  title,
  description,
}: ImportacionCardProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<ImportacionResultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function descargarPlantilla() {
    const blob = new Blob([buildCsvTemplate(tipo)], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `plantilla-${tipo}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)
    setResultado(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch(buildImportUrl(tipo), {
        method: "POST",
        body: formData,
      })
      const data = (await response.json().catch(() => null)) as unknown

      if (!response.ok) {
        setError(
          extraerMensajeError(response.status, data) ||
            `Error ${response.status}: no se pudo importar el archivo.`,
        )
        return
      }

      const payload = data as {
        data?: {
          procesadas?: number
          insertadas?: number
          actualizadas?: number
          errores?: { fila: number; mensaje: string }[]
        }
      }
      setResultado({
        procesadas: payload.data?.procesadas ?? 0,
        insertadas: payload.data?.insertadas ?? 0,
        actualizadas: payload.data?.actualizadas ?? 0,
        errores: Array.isArray(payload.data?.errores)
          ? payload.data.errores
          : [],
      })
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo contactar al servidor. Intentá de nuevo.",
      )
    } finally {
      setLoading(false)
    }
  }

  const columnas = buildCsvTemplate(tipo).split("\n")[0] ?? ""

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Columnas esperadas
          </p>
          <code className="mt-1 block break-all rounded-md bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
            {columnas}
          </code>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={descargarPlantilla}
        >
          <Download className="size-4" aria-hidden="true" />
          Descargar plantilla
        </Button>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor={`import-file-${tipo}`}
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Archivo CSV
            </label>
            <input
              id={`import-file-${tipo}`}
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) =>
                setFile(event.target.files?.[0] ?? null)
              }
              className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!file || loading}
          >
            <Upload className="size-4" aria-hidden="true" />
            {loading ? "Importando..." : "Importar"}
          </Button>
        </form>

        {resultado ? (
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <p className="font-medium text-foreground">Resultado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Procesadas: {" "}
              <span className="font-mono font-medium text-foreground">
                {resultado.procesadas}
              </span>
              {" · "}Insertadas: {" "}
              <span className="font-mono font-medium text-foreground">
                {resultado.insertadas}
              </span>
              {" · "}Actualizadas: {" "}
              <span className="font-mono font-medium text-foreground">
                {resultado.actualizadas}
              </span>
            </p>
            {resultado.errores.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-destructive">
                  Errores por fila
                </p>
                <ul className="mt-1 max-h-40 list-inside list-disc overflow-auto text-xs text-muted-foreground">
                  {resultado.errores.map((err) => (
                    <li key={`${err.fila}-${err.mensaje}`}>
                      Fila {err.fila}: {err.mensaje}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Las filas válidas se importaron. Corregí las inválidas y
                  volvé a subir el archivo completo si es necesario.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="text-xs font-medium text-destructive"
          >
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function extraerMensajeError(
  status: number,
  data: unknown,
): string | undefined {
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string" &&
    data.message
  ) {
    return data.message
  }
  if (status === 401) return "Sesión expirada. Volvé a iniciar sesión."
  if (status === 403)
    return "No tenés permisos para importar este tipo de archivo."
  if (status === 502) return "El backend no respondió."
}
