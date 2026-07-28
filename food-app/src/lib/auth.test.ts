import { describe, expect, it } from "vitest";
import { getAuthRedirectUrl, getOAuthRedirectError } from "@/lib/auth";

describe("authentication redirect helpers", () => {
  it("builds the exact application redirect under the Vite base path", () => {
    expect(getAuthRedirectUrl("https://armutie.github.io", "/food/")).toBe(
      "https://armutie.github.io/food/",
    );
  });

  it("turns OAuth callback fragments into actionable messages", () => {
    expect(
      getOAuthRedirectError(
        "https://armutie.github.io/food/#error=access_denied&error_code=access_denied",
      ),
    ).toBe("Google sign-in was cancelled. You can try again or use email instead.");

    expect(
      getOAuthRedirectError(
        "https://armutie.github.io/food/?error=server_error&error_code=over_request_rate_limit",
      ),
    ).toBe("Too many sign-in attempts were made. Wait a few minutes, then try again.");
  });

  it("ignores ordinary hash routes", () => {
    expect(getOAuthRedirectError("https://armutie.github.io/food/#/history")).toBeNull();
  });
});
