import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppContext } from "@/app-context";
import { History } from "@/features/History";
import { createMockServices } from "@/services/mock";

describe("History date control", () => {
  it("shows a labelled selected date while preserving the native date input", async () => {
    const services = createMockServices();
    const user = await services.auth.getUser();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AppContext.Provider value={{ services, user: user! }}>
          <History />
        </AppContext.Provider>
      </QueryClientProvider>,
    );

    const dateInput = await screen.findByLabelText("Choose history date");
    expect(screen.getByText("Date")).toBeVisible();
    expect(dateInput).toHaveAttribute("type", "date");

    fireEvent.change(dateInput, { target: { value: "2026-07-20" } });
    expect(screen.getByText("Jul 20, 2026")).toBeVisible();
  });
});
