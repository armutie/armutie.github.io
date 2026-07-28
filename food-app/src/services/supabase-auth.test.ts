import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  SUPABASE_AUTH_OPTIONS,
  SupabaseAuthService,
} from "@/services/supabase";

function createClient() {
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email: "person@example.com" } },
      error: null,
    }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  };

  return {
    auth,
    client: { auth } as unknown as SupabaseClient,
  };
}

describe("SupabaseAuthService", () => {
  it("starts Google OAuth with the exact production /food/ redirect", async () => {
    const { auth, client } = createClient();
    const service = new SupabaseAuthService(client, "https://armutie.github.io/food/");

    await service.signInWithGoogle();

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://armutie.github.io/food/" },
    });
  });

  it("uses the same redirect for the email fallback", async () => {
    const { auth, client } = createClient();
    const service = new SupabaseAuthService(client, "https://armutie.github.io/food/");

    await service.sendMagicLink("person@example.com");

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: { emailRedirectTo: "https://armutie.github.io/food/" },
    });
  });

  it("turns email throttling into an actionable rate-limit error", async () => {
    const { auth, client } = createClient();
    auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: {
        code: "over_email_send_rate_limit",
        status: 429,
      },
    });
    const service = new SupabaseAuthService(client, "https://armutie.github.io/food/");

    await expect(service.sendMagicLink("person@example.com")).rejects.toMatchObject({
      code: "auth-rate-limit",
      message: "A sign-in email was requested recently. Wait a minute before trying again.",
    });
  });

  it("keeps session restoration enabled after OAuth redirects", () => {
    expect(SUPABASE_AUTH_OPTIONS).toEqual({
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    });
  });
});
