import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")
  if (!apiUrl) {
    return Response.json({ message: "NEXT_PUBLIC_API_URL no está definida." }, { status: 500 })
  }

  const token = (await cookies()).get("session_token")?.value
  const response = await fetch(`${apiUrl}/api/v1/dispositivos/events`, {
    headers: { Cookie: `session_token=${token ?? ""}`, Accept: "text/event-stream" }, cache: "no-store",
  })
  return new Response(response.body, { status: response.status, headers: {
    "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive",
  } })
}
