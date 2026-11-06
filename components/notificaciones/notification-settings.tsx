"use client"

import { useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  RefreshCw,
  Save,
  Send,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { ROLE_COLORS } from "@/lib/role-badge"
import {
  getNotificationSettingsAction,
  sendTestNotificationAction,
  updateNotificationPreferencesAction,
} from "@/actions/notifications"
import {
  CHANNEL_LABELS,
  isValidTelegramChatId,
  normalizeTelegramChatId,
  type NotificationChannel,
  type NotificationRecipient,
  type NotificationSettingsData,
} from "@/lib/notification-settings"
import type { UserRole } from "@/lib/auth"

interface NotificationSettingsProps {
  initialData?: NotificationSettingsData
  initialError?: string
}

interface RecipientDraft {
  telegramChatId: string
  notifyEmail: boolean
  notifyTelegram: boolean
}

export function NotificationSettings({
  initialData,
  initialError,
}: NotificationSettingsProps) {
  const [recipients, setRecipients] = useState<NotificationRecipient[]>(
    initialData?.recipients ?? [],
  )
  const [channels, setChannels] = useState<NotificationSettingsData["channels"]>(
    initialData?.channels ?? {
      email: { configured: false },
      telegram: { configured: false },
    },
  )
  const [loadError, setLoadError] = useState<string | null>(initialError ?? null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, RecipientDraft>>(() =>
    buildDrafts(initialData?.recipients ?? []),
  )
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set())
  const [pendingTests, setPendingTests] = useState<Set<string>>(new Set())
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const pendingIds = useRef(createOperationTracker())

  function setRowPending(id: string, pending: boolean) {
    if (!pending) pendingIds.current.end(id)
    setPendingSaves(pendingIds.current.snapshot())
  }

  function setTestPending(id: string, pending: boolean) {
    setPendingTests((prev) => {
      const next = new Set(prev)
      if (pending) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleRetry() {
    if (isRefreshing) return
    setIsRefreshing(true)
    getNotificationSettingsAction()
      .then((result) => {
        if (result.ok) {
          setRecipients(result.data.recipients)
          setDrafts(buildDrafts(result.data.recipients))
          setChannels(result.data.channels)
          setLoadError(null)
        } else {
          setLoadError(result.message ?? "No se pudo recargar la configuración.")
        }
      })
      .catch(() => {
        setLoadError("No se pudo recargar la configuración.")
      })
      .finally(() => setIsRefreshing(false))
  }

  function handleChatIdChange(userId: string, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], telegramChatId: value },
    }))
    setRowErrors((prev) => ({ ...prev, [userId]: "" }))
  }

  function handleToggle(
    userId: string,
    field: "notifyEmail" | "notifyTelegram",
  ) {
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: !prev[userId][field] },
    }))
    setRowErrors((prev) => ({ ...prev, [userId]: "" }))
  }

  async function handleSave(user: NotificationRecipient) {
    const draft = drafts[user.userId]
    if (!draft) return
    if (!pendingIds.current.begin(user.userId)) return

    const normalizedChatId = normalizeTelegramChatId(draft.telegramChatId)
    if (
      normalizedChatId !== null &&
      normalizedChatId !== user.telegramChatId &&
      !isValidTelegramChatId(normalizedChatId)
    ) {
      setRowErrors((prev) => ({
        ...prev,
        [user.userId]:
          "El chat ID de Telegram debe tener entre 5 y 20 dígitos (puede empezar con '-').",
      }))
      setRowPending(user.userId, false)
      return
    }

    setRowPending(user.userId, true)
    setRowErrors((prev) => ({ ...prev, [user.userId]: "" }))

    const payload = {
      telegramChatId:
        draft.telegramChatId !== (user.telegramChatId ?? "")
          ? normalizedChatId
          : undefined,
      notifyEmail: draft.notifyEmail !== user.notifyEmail ? draft.notifyEmail : undefined,
      notifyTelegram:
        draft.notifyTelegram !== user.notifyTelegram ? draft.notifyTelegram : undefined,
    }

    const result = await updateNotificationPreferencesAction(user.userId, payload)
    setRowPending(user.userId, false)

    if (result.ok && result.recipient) {
      setRecipients((prev) =>
        prev.map((r) => (r.userId === result.recipient!.userId ? result.recipient! : r)),
      )
      setDrafts((prev) => ({
        ...prev,
        [result.recipient!.userId]: buildDraft(result.recipient!),
      }))
      toast.success("Preferencias guardadas.")
    } else {
      setRowErrors((prev) => ({
        ...prev,
        [user.userId]: result.message ?? "No se pudieron guardar las preferencias.",
      }))
      toast.error(result.message ?? "No se pudieron guardar las preferencias.")
    }
  }

  async function handleTest(user: NotificationRecipient, channel: NotificationChannel) {
    setTestPending(user.userId, true)
    setRowErrors((prev) => ({ ...prev, [user.userId]: "" }))

    const result = await sendTestNotificationAction(user.userId, channel)
    setTestPending(user.userId, false)

    if (result.ok) {
      toast.success(result.message)
    } else {
      setRowErrors((prev) => ({
        ...prev,
        [user.userId]: result.message,
      }))
      toast.error(result.message)
    }
  }

  const isLoadError = Boolean(loadError)

  return (
    <div className="space-y-8">
      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 ring-1 ring-destructive/30">
            <AlertCircle className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-1 items-center justify-between gap-3">
            <span className="pt-1">{loadError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                "Reintentar"
              )}
            </Button>
          </div>
        </div>
      )}

      <section aria-labelledby="canales-heading" className="space-y-4">
        <div>
          <h2
            id="canales-heading"
            className="text-base font-semibold text-foreground"
          >
            Canales configurados
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Estado de los proveedores en el backend. Los secretos se configuran
            únicamente en el servidor.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChannelCard
            channel="EMAIL"
            configured={channels.email.configured}
            sender={channels.email.sender}
            requiredVars={["RESEND_API_KEY", "NOTIFICACIONES_EMAIL_FROM"]}
          />
          <ChannelCard
            channel="TELEGRAM"
            configured={channels.telegram.configured}
            requiredVars={["TELEGRAM_BOT_TOKEN"]}
          />
        </div>
      </section>

      <section aria-labelledby="reglas-heading" className="space-y-4">
        <div>
          <h2
            id="reglas-heading"
            className="text-base font-semibold text-foreground"
          >
            Reglas de envío
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Todos los usuarios activos reciben alertas de severidad{" "}
            <span className="font-medium text-foreground">WARNING</span> y{" "}
            <span className="font-medium text-foreground">CRITICAL</span>{" "}
            según los canales habilitados. Telegram requiere que el usuario le
            haya enviado <code className="rounded bg-muted px-1 py-0.5 text-xs">/start</code>{" "}
            al bot.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-medium text-foreground">
            Cómo obtener el chat ID de Telegram
          </h3>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
            <li>Creá el bot con @BotFather y copiá el token en el backend.</li>
            <li>El usuario debe abrir el bot y enviarle /start.</li>
            <li>
              Consultá la URL{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                https://api.telegram.org/bot&lt;token&gt;/getUpdates
              </code>{" "}
              para ver el chat ID (un número, en grupos empieza con -).
            </li>
          </ol>
        </div>
      </section>

      <section aria-labelledby="destinatarios-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2
              id="destinatarios-heading"
              className="text-base font-semibold text-foreground"
            >
              Destinatarios
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Editá el chat ID de Telegram y los canales activos de cada usuario.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            {isLoadError
              ? "— No disponible"
              : `${recipients.length} ${recipients.length === 1 ? "usuario" : "usuarios"}`}
          </span>
        </div>

        {/* Vista móvil */}
        <div className="space-y-3 2xl:hidden" aria-label="Destinatarios en formato compacto">
          {isLoadError ? (
            <UnavailableState />
          ) : recipients.length === 0 ? (
            <EmptyState />
          ) : (
            recipients.map((user) => (
              <RecipientMobileCard
                key={user.userId}
                user={user}
                draft={drafts[user.userId]}
                isSaving={pendingSaves.has(user.userId)}
                isTesting={pendingTests.has(user.userId)}
                error={rowErrors[user.userId]}
                onChatIdChange={handleChatIdChange}
                onToggle={handleToggle}
                onSave={handleSave}
                onTest={handleTest}
              />
            ))
          )}
        </div>

        {/* Vista escritorio */}
        <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm 2xl:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Destinatarios de notificaciones</caption>
              <thead className="border-b border-border bg-secondary/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Chat ID Telegram</th>
                  <th className="px-6 py-4 text-center">Email</th>
                  <th className="px-6 py-4 text-center">Telegram</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadError || recipients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12">
                      {isLoadError ? <UnavailableState /> : <EmptyState />}
                    </td>
                  </tr>
                ) : (
                  recipients.map((user) => (
                    <RecipientDesktopRow
                      key={user.userId}
                      user={user}
                      draft={drafts[user.userId]}
                      isSaving={pendingSaves.has(user.userId)}
                      isTesting={pendingTests.has(user.userId)}
                      error={rowErrors[user.userId]}
                      onChatIdChange={handleChatIdChange}
                      onToggle={handleToggle}
                      onSave={handleSave}
                      onTest={handleTest}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  configured,
  sender,
  requiredVars,
}: {
  channel: NotificationChannel
  configured: boolean
  sender?: string | null
  requiredVars: string[]
}) {
  const Icon = channel === "EMAIL" ? Mail : Send
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl",
          configured ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">
            {CHANNEL_LABELS[channel]}
          </h3>
          {configured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success ring-1 ring-inset ring-success/40">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              Configurado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-inset ring-border">
              <XCircle className="size-3" aria-hidden="true" />
              Sin configurar
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Variables:{" "}
          {requiredVars.map((v) => (
            <code
              key={v}
              className="mr-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]"
            >
              {v}
            </code>
          ))}
        </p>
        {channel === "EMAIL" && sender && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Remitente: <span className="text-foreground">{sender}</span>
          </p>
        )}
      </div>
    </div>
  )
}

function RecipientMobileCard({
  user,
  draft,
  isSaving,
  isTesting,
  error,
  onChatIdChange,
  onToggle,
  onSave,
  onTest,
}: {
  user: NotificationRecipient
  draft?: RecipientDraft
  isSaving: boolean
  isTesting: boolean
  error?: string
  onChatIdChange: (userId: string, value: string) => void
  onToggle: (userId: string, field: "notifyEmail" | "notifyTelegram") => void
  onSave: (user: NotificationRecipient) => void
  onTest: (user: NotificationRecipient, channel: NotificationChannel) => void
}) {
  const current = draft ?? buildDraft(user)
  const dirty = isDirty(user, current)
  // Probar usa el chat ID ya guardado; si hay un borrador sin guardar no sirve.
  const telegramDisabled = !user.telegramChatId

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-1 ring-primary/30">
          {user.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-foreground">{user.nombre}</h3>
          <p className="mt-0.5 break-all text-xs text-muted-foreground">{user.email}</p>
        </div>
        <StatusBadge active={user.activo} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rol
          </dt>
          <dd className="mt-1">
            <RoleBadge rol={user.rol} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Chat ID Telegram
          </dt>
          <dd className="mt-1">
            <Input
              type="text"
              inputMode="numeric"
              aria-label={`Chat ID de Telegram de ${user.nombre}`}
              value={current.telegramChatId}
              onChange={(e) => onChatIdChange(user.userId, e.target.value)}
              disabled={isSaving}
              placeholder="—"
              className="h-8 text-xs"
            />
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-3">
        <ToggleField
          userId={user.userId}
          label="Email"
          checked={current.notifyEmail}
          disabled={isSaving}
          onToggle={() => onToggle(user.userId, "notifyEmail")}
        />
        <ToggleField
          userId={user.userId}
          label="Telegram"
          checked={current.notifyTelegram}
          disabled={isSaving}
          onToggle={() => onToggle(user.userId, "notifyTelegram")}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || isSaving}
          onClick={() => onSave(user)}
          className="col-span-1 h-8 gap-1.5 text-xs"
        >
          {isSaving ? (
            <RefreshCw className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Guardar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSaving || isTesting}
          onClick={() => onTest(user, "EMAIL")}
          className="h-8 text-xs"
        >
          Probar email
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSaving || isTesting || telegramDisabled}
          onClick={() => onTest(user, "TELEGRAM")}
          className="h-8 text-xs"
        >
          Probar Telegram
        </Button>
      </div>
    </article>
  )
}

function RecipientDesktopRow({
  user,
  draft,
  isSaving,
  isTesting,
  error,
  onChatIdChange,
  onToggle,
  onSave,
  onTest,
}: {
  user: NotificationRecipient
  draft?: RecipientDraft
  isSaving: boolean
  isTesting: boolean
  error?: string
  onChatIdChange: (userId: string, value: string) => void
  onToggle: (userId: string, field: "notifyEmail" | "notifyTelegram") => void
  onSave: (user: NotificationRecipient) => void
  onTest: (user: NotificationRecipient, channel: NotificationChannel) => void
}) {
  const current = draft ?? buildDraft(user)
  const dirty = isDirty(user, current)
  // Probar usa el chat ID ya guardado; si hay un borrador sin guardar no sirve.
  const telegramDisabled = !user.telegramChatId

  return (
    <>
      <tr className="transition-colors hover:bg-secondary/40">
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/30">
              {user.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground">{user.nombre}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <RoleBadge rol={user.rol} />
        </td>
        <td className="px-6 py-4">
          <StatusBadge active={user.activo} />
        </td>
        <td className="px-6 py-4">
          <Input
            type="text"
            inputMode="numeric"
            aria-label={`Chat ID de Telegram de ${user.nombre}`}
            value={current.telegramChatId}
            onChange={(e) => onChatIdChange(user.userId, e.target.value)}
            disabled={isSaving}
            placeholder="—"
            className="h-8 w-40 text-xs"
          />
        </td>
        <td className="px-6 py-4 text-center">
          <Switch
            checked={current.notifyEmail}
            onCheckedChange={() => onToggle(user.userId, "notifyEmail")}
            disabled={isSaving}
            aria-label={`Notificar por email a ${user.nombre}`}
          />
        </td>
        <td className="px-6 py-4 text-center">
          <Switch
            checked={current.notifyTelegram}
            onCheckedChange={() => onToggle(user.userId, "notifyTelegram")}
            disabled={isSaving}
            aria-label={`Notificar por Telegram a ${user.nombre}`}
          />
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!dirty || isSaving}
              onClick={() => onSave(user)}
              className="h-8 gap-1.5 text-xs"
            >
              {isSaving ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving || isTesting}
              onClick={() => onTest(user, "EMAIL")}
              className="h-8 text-xs"
            >
              Probar email
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving || isTesting || telegramDisabled}
              onClick={() => onTest(user, "TELEGRAM")}
              className="h-8 text-xs"
            >
              Probar Telegram
            </Button>
          </div>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={7} className="px-6 py-0">
            <div
              role="alert"
              className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function ToggleField({
  userId,
  label,
  checked,
  disabled,
  onToggle,
}: {
  userId: string
  label: string
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={`${userId}-${label}`}
        checked={checked}
        onCheckedChange={onToggle}
        disabled={disabled}
        size="sm"
      />
      <Label htmlFor={`${userId}-${label}`} className="text-xs font-normal">
        {label}
      </Label>
    </div>
  )
}

function RoleBadge({ rol }: { rol: UserRole }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border bg-clip-padding px-2.5 py-1 text-xs font-semibold",
        ROLE_COLORS[rol],
      )}
    >
      {rol}
    </span>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-[11px] font-semibold text-success ring-1 ring-inset ring-success/40">
      <CheckCircle2 className="size-3" aria-hidden="true" /> Activo
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border">
      <XCircle className="size-3" aria-hidden="true" /> Inactivo
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
        <Mail className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">Sin destinatarios</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        No hay usuarios configurados para recibir notificaciones.
      </p>
    </div>
  )
}

function UnavailableState() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
        <AlertCircle className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">
        Destinatarios no disponibles
      </p>
      <p className="max-w-xs text-xs text-muted-foreground">
        No se puede mostrar el listado mientras la consulta falla.
      </p>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDraft(user: NotificationRecipient): RecipientDraft {
  return {
    telegramChatId: user.telegramChatId ?? "",
    notifyEmail: user.notifyEmail,
    notifyTelegram: user.notifyTelegram,
  }
}

function buildDrafts(users: NotificationRecipient[]): Record<string, RecipientDraft> {
  return Object.fromEntries(users.map((u) => [u.userId, buildDraft(u)]))
}

function isDirty(user: NotificationRecipient, draft: RecipientDraft): boolean {
  return (
    normalizeTelegramChatId(draft.telegramChatId) !== user.telegramChatId ||
    draft.notifyEmail !== user.notifyEmail ||
    draft.notifyTelegram !== user.notifyTelegram
  )
}

function createOperationTracker() {
  const pending = new Set<string>()
  return {
    begin(id: string): boolean {
      if (pending.has(id)) return false
      pending.add(id)
      return true
    },
    end(id: string) {
      pending.delete(id)
    },
    snapshot() {
      return new Set(pending)
    },
  }
}
