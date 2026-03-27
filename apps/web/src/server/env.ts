import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean().optional());

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/stockly?schema=public"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(16).default("replace-this-session-secret"),
  KIOSK_SECRET: z.string().min(16).default("replace-this-kiosk-secret"),
  COOKIE_SECURE: booleanFromEnv
});

const parsedEnv = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_URL: process.env.APP_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  KIOSK_SECRET: process.env.KIOSK_SECRET,
  COOKIE_SECURE: process.env.COOKIE_SECURE
});

export const env = {
  ...parsedEnv,
  COOKIE_SECURE: parsedEnv.COOKIE_SECURE ?? new URL(parsedEnv.APP_URL).protocol === "https:"
};
