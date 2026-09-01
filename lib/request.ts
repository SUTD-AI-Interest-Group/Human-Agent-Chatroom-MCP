import { createHash } from "node:crypto";

export function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded ?? request.headers.get("x-real-ip") ?? "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 160) ?? "unknown";
  return createHash("sha256").update(`${address}\u0000${userAgent}`).digest("hex");
}
