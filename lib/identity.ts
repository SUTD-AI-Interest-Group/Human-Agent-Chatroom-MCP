import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const adjectives = [
  "Amber",
  "Blue",
  "Brisk",
  "Calm",
  "Coral",
  "Green",
  "Indigo",
  "Merry",
  "Quiet",
  "Silver",
  "Swift",
  "Warm",
] as const;

const animals = [
  "Badger",
  "Crane",
  "Fox",
  "Gecko",
  "Heron",
  "Koala",
  "Otter",
  "Panda",
  "Robin",
  "Seal",
  "Tiger",
  "Wren",
] as const;

export function temporaryDisplayName() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adjective} ${animal}`;
}

export function roomCode() {
  const buffer = randomBytes(4);
  return String(buffer.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function createAgentToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAgentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenHashesMatch(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
