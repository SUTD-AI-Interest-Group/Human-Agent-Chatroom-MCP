import { z } from "zod";

export const roomCodeSchema = z.string().trim().regex(/^\d{6}$/);
export const displayNameSchema = z.string().trim().min(2).max(32);
export const messageBodySchema = z.string().trim().min(1).max(4_000);

export const createRoomSchema = z.object({
  displayName: displayNameSchema.optional(),
});

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
  displayName: displayNameSchema.optional(),
});

export const sendHumanMessageSchema = z.object({
  body: messageBodySchema,
  replyToMessageId: z.number().int().positive().nullable().optional(),
  mentionAgentIds: z.array(z.string().uuid()).max(8).default([]),
});

export const createAgentSchema = z.object({
  displayName: displayNameSchema,
  capabilities: z
    .array(z.enum(["read_context", "read_messages", "send_messages", "status"]))
    .min(1)
    .max(4)
    .default(["read_context", "read_messages", "send_messages", "status"]),
});

export function safeSearchTerm(value: string) {
  return value.trim().replace(/[\\%_]/g, "").slice(0, 120);
}
