import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthScreen } from "@/features/AuthScreen";
import type { AuthService } from "@/services/interfaces";

function createAuthService(): AuthService {
  return {
    getUser: vi.fn().mockResolvedValue(null),
    sendMagicLink: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
  };
}

describe("AuthScreen magic-link confirmation", () => {
  it("shows the normalized destination and lets the user change it", async () => {
    const user = userEvent.setup();
    const auth = createAuthService();
    render(<AuthScreen auth={auth} />);

    await user.type(screen.getByLabelText("Email address"), "  Test.User@Example.COM  ");
    await user.click(screen.getByRole("button", { name: /continue with email/i }));

    await waitFor(() => {
      expect(auth.sendMagicLink).toHaveBeenCalledWith("test.user@example.com");
    });
    expect(screen.getByText("test.user@example.com")).toBeVisible();
    expect(screen.getByText(/we sent a secure sign-in link to/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /change email/i }));

    const emailInput = screen.getByLabelText("Email address");
    expect(emailInput).toHaveValue("test.user@example.com");
    expect(emailInput).toHaveFocus();
  });
});
