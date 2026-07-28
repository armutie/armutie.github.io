import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthScreen } from "@/features/AuthScreen";
import { ServiceError } from "@/services/errors";
import type { AuthService } from "@/services/interfaces";

function createAuthService(): AuthService {
  return {
    getUser: vi.fn().mockResolvedValue(null),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    sendMagicLink: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
  };
}

describe("AuthScreen authentication", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading state while Google redirects", async () => {
    const user = userEvent.setup();
    const auth = createAuthService();
    vi.mocked(auth.signInWithGoogle).mockReturnValue(new Promise(() => undefined));
    render(<AuthScreen auth={auth} />);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(screen.getByRole("button", { name: "Connecting to Google..." })).toBeDisabled();
    expect(screen.getByLabelText("Email address")).toBeDisabled();
  });

  it("presents Google as the primary method and handles an OAuth start failure", async () => {
    const user = userEvent.setup();
    const auth = createAuthService();
    vi.mocked(auth.signInWithGoogle).mockRejectedValue(
      new ServiceError(
        "unauthorized",
        "Google sign-in is not available right now. Use email instead.",
      ),
    );
    render(<AuthScreen auth={auth} />);

    const googleButton = screen.getByRole("button", { name: "Continue with Google" });
    const emailButton = screen.getByRole("button", { name: "Continue with email" });
    expect(
      googleButton.compareDocumentPosition(emailButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(googleButton);

    expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText("Google sign-in is not available right now. Use email instead."),
    ).toHaveAttribute("role", "alert");
  });

  it("shows OAuth callback errors while keeping the email fallback available", () => {
    render(
      <AuthScreen
        auth={createAuthService()}
        initialOAuthError="Google sign-in was cancelled. You can try again or use email instead."
      />,
    );

    expect(screen.getByText(/google sign-in was cancelled/i)).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("Email address")).toBeEnabled();
  });

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

  it("shows a specific rate-limit message for magic-link requests", async () => {
    const user = userEvent.setup();
    const auth = createAuthService();
    vi.mocked(auth.sendMagicLink).mockRejectedValue(
      new ServiceError(
        "auth-rate-limit",
        "A sign-in email was requested recently. Wait a minute before trying again.",
      ),
    );
    render(<AuthScreen auth={auth} />);

    await user.type(screen.getByLabelText("Email address"), "person@example.com");
    await user.click(screen.getByRole("button", { name: "Continue with email" }));

    expect(
      await screen.findByText(
        "A sign-in email was requested recently. Wait a minute before trying again.",
      ),
    ).toHaveAttribute("role", "alert");
  });
});
