import { NextResponse } from "next/server";
import {
  ApiError,
  createAdminClient,
  errorResponse,
  requireActiveMembership,
  requireHuman,
} from "@/lib/api";

export async function POST(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const admin = createAdminClient();

  try {
    const user = await requireHuman();
    const { roomId } = await context.params;
    const { room } = await requireActiveMembership(admin, roomId, user.id);
    if (room.created_by !== user.id) throw new ApiError(403, "Only the room creator can close it.");

    await admin.from("experiment_events").insert({
      room_id: roomId,
      actor_user_id: user.id,
      event_name: "room_closed",
      properties: {
        lifetime_seconds: Math.round((Date.now() - new Date(room.created_at).getTime()) / 1_000),
      },
    });
    const { error } = await admin.from("rooms").delete().eq("id", roomId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
