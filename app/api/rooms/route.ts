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
import { roomCode, temporaryDisplayName } from "@/lib/identity";
import { createRoomSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const admin = createAdminClient();

  try {
    const user = await requireHuman();
    const parsed = createRoomSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Choose a display name under 32 characters.");
    await consumeRateLimit(admin, "create-room", user.id, 6, 3_600);

    const displayName = parsed.data.displayName ?? temporaryDisplayName();
    await admin.from("users").upsert({ id: user.id, display_name: displayName });

    let createdRoom: { id: string; code: string; created_at: string } | null = null;
    for (let attempt = 0; attempt < 8 && !createdRoom; attempt += 1) {
      const { data, error } = await admin
        .from("rooms")
        .insert({ code: roomCode(), created_by: user.id })
        .select("id, code, created_at")
        .single();

      if (!error) createdRoom = data;
      else if (error.code !== "23505") throw error;
    }
    if (!createdRoom) throw new ApiError(503, "Could not allocate a room code. Try again.");

    const { error: memberError } = await admin.from("room_members").insert({
      room_id: createdRoom.id,
      user_id: user.id,
      status: "online",
    });
    if (memberError) {
      await admin.from("rooms").delete().eq("id", createdRoom.id);
      throw memberError;
    }

    await Promise.all([
      insertSystemMessage(admin, createdRoom.id, `${displayName} opened the room.`, {
        event: "room_created",
      }),
      admin.from("experiment_events").insert({
        room_id: createdRoom.id,
        actor_user_id: user.id,
        event_name: "room_created",
      }),
    ]);

    return NextResponse.json(
      { room: { id: createdRoom.id, code: createdRoom.code } },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
