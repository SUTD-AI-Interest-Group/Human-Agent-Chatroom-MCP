import { NextResponse } from "next/server";
import {
  ApiError,
  consumeRateLimit,
  createAdminClient,
  errorResponse,
  insertSystemMessage,
  readJson,
  requireHuman,
} from "@/lib/api";
import { temporaryDisplayName } from "@/lib/identity";
import { requestFingerprint } from "@/lib/request";
import { joinRoomSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const admin = createAdminClient();

  try {
    const user = await requireHuman();
    const parsed = joinRoomSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Enter a valid six-digit room code.");
    await Promise.all([
      consumeRateLimit(admin, "join-room-user", user.id, 30, 3_600),
      consumeRateLimit(admin, "join-room-network", requestFingerprint(request), 80, 3_600),
    ]);

    const { data: room } = await admin
      .from("rooms")
      .select("id, code, created_by")
      .eq("code", parsed.data.code)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!room) throw new ApiError(404, "That room does not exist or has expired.");

    const { data: existingProfile } = await admin
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const displayName =
      parsed.data.displayName ?? existingProfile?.display_name ?? temporaryDisplayName();
    await admin.from("users").upsert({ id: user.id, display_name: displayName });

    const { data: existingMember } = await admin
      .from("room_members")
      .select("user_id, left_at")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .maybeSingle();

    await admin.from("room_members").upsert(
      {
        room_id: room.id,
        user_id: user.id,
        status: "online",
        left_at: null,
      },
      { onConflict: "room_id,user_id" },
    );

    if (!existingMember || existingMember.left_at) {
      await Promise.all([
        insertSystemMessage(admin, room.id, `${displayName} joined the room.`, {
          event: "member_joined",
          user_id: user.id,
        }),
        admin.from("experiment_events").insert({
          room_id: room.id,
          actor_user_id: user.id,
          event_name: "room_joined",
        }),
      ]);
    }

    return NextResponse.json({ room: { id: room.id, code: room.code } });
  } catch (error) {
    return errorResponse(error);
  }
}
