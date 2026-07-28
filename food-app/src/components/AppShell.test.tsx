import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";

describe("AppShell account menu", () => {
  it("does not sign out from the trigger and exposes email plus a labelled action", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(
      <AppShell demoMode email="cook@example.com" onSignOut={onSignOut}>
        <p>Page content</p>
      </AppShell>,
    );

    const trigger = screen.getByRole("button", { name: "Open account menu for cook@example.com" });
    await user.click(trigger);

    expect(onSignOut).not.toHaveBeenCalled();
    expect(screen.getByText("cook@example.com")).toBeVisible();
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
