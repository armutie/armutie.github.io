import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppContext } from "@/app-context";
import { AddMealFlow } from "@/features/AddMealFlow";
import { createMockServices } from "@/services/mock";

describe("AddMealFlow photo sources", () => {
  it("uses separate rear-camera and photo-library inputs", async () => {
    const services = createMockServices();
    const user = await services.auth.getUser();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AppContext.Provider value={{ services, user: user! }}>
          <AddMealFlow />
        </AppContext.Provider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Take photo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose from library" })).toBeVisible();

    const cameraInput = container.querySelector<HTMLInputElement>('input[data-photo-source="camera"]');
    const libraryInput = container.querySelector<HTMLInputElement>('input[data-photo-source="library"]');
    expect(cameraInput).toHaveAttribute("accept", "image/*");
    expect(cameraInput).toHaveAttribute("capture", "environment");
    expect(libraryInput).toHaveAttribute("accept", "image/*");
    expect(libraryInput).not.toHaveAttribute("capture");
  });
});
