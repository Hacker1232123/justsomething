import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z.string().optional(),
  INVITE_BASE_URL: z.string().url().optional().default("http://localhost:5173"),
  DISCONNECT_HOLD_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  IDLE_ROOM_MS: z.coerce.number().int().positive().default(30 * 60 * 1000)
});

const parsed = envSchema.parse({
  PORT: process.env.PORT,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  INVITE_BASE_URL: process.env.INVITE_BASE_URL,
  DISCONNECT_HOLD_MS: process.env.DISCONNECT_HOLD_MS,
  IDLE_ROOM_MS: process.env.IDLE_ROOM_MS
});

const corsOrigins = parsed.CORS_ORIGINS
  ? parsed.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : ["http://localhost:5173", "http://localhost:4173"];

export const config = {
  ...parsed,
  corsOrigins
};
