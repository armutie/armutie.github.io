import { z } from "zod";

const envSchema = z
  .object({
    VITE_DEMO_MODE: z.enum(["true", "false"]).default("false"),
    VITE_SUPABASE_URL: z.string().url().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.VITE_DEMO_MODE === "false" && (!value.VITE_SUPABASE_URL || !value.VITE_SUPABASE_ANON_KEY)) {
      context.addIssue({
        code: "custom",
        message: "Supabase URL and anon key are required when demo mode is disabled.",
      });
    }
  });

export type AppEnvironment = {
  demoMode: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  configurationError?: string;
};

export function readEnvironment(source: ImportMetaEnv = import.meta.env): AppEnvironment {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    return {
      demoMode: source.VITE_DEMO_MODE === "true",
      configurationError: parsed.error.issues.map((issue) => issue.message).join(" "),
    };
  }

  return {
    demoMode: parsed.data.VITE_DEMO_MODE === "true",
    supabaseUrl: parsed.data.VITE_SUPABASE_URL,
    supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY,
  };
}
