import { NextResponse } from "next/server";
import {
  createAdminClient,
  errorResponse,
  getRoomSnapshot,
  requireHuman,
} from "@/lib/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const user = await requireHuman();
    const { roomId } = await context.params;
    const snapshot = await getRoomSnapshot(createAdminClient(), roomId, user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return errorResponse(error);
  }
}
