import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppContext } from "@/app-context";
import { AddMealFlow } from "@/features/AddMealFlow";
import { createMockServices } from "@/services/mock";

describe("AddMealFlow photo sources", () => {
  async function renderFlow() {
    const services = createMockServices();
    const user = await services.auth.getUser();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <AppContext.Provider value={{ services, user: user! }}>
          <AddMealFlow />
        </AppContext.Provider>
      </QueryClientProvider>,
    );
  }

  it("uses separate rear-camera and photo-library inputs", async () => {
    const { container } = await renderFlow();
    expect(screen.getByRole("button", { name: "Take photo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose from library" })).toBeVisible();

    const cameraInput = container.querySelector<HTMLInputElement>('input[data-photo-source="camera"]');
    const libraryInput = container.querySelector<HTMLInputElement>('input[data-photo-source="library"]');
    expect(cameraInput).toHaveAttribute("accept", "image/*");
    expect(cameraInput).toHaveAttribute("capture", "environment");
    expect(libraryInput).toHaveAttribute("accept", "image/*");
    expect(libraryInput).not.toHaveAttribute("capture");
  });

  it("keeps the optional reference choices collapsed and uses one generic phone option", async () => {
    const user = userEvent.setup();
    const { container } = await renderFlow();
    const disclosure = container.querySelector("details.reference-disclosure");

    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.getByText("No reference object selected")).toBeVisible();

    const summary = screen.getByText("Improve portion estimate").closest("summary");
    expect(summary).not.toBeNull();
    await user.click(summary!);

    expect(disclosure).toHaveAttribute("open");
    await user.click(screen.getByRole("radio", { name: /Phone/ }));
    expect(screen.getByText("Reference: Phone")).toBeVisible();
    expect(screen.queryByText("iPhone 15")).not.toBeInTheDocument();
    expect(screen.queryByText("15 Pro Max")).not.toBeInTheDocument();
  });
});
