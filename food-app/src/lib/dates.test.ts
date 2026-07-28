import { describe, expect, it } from "vitest";
import { dayKey, groupMealsByDay } from "@/lib/dates";
import { MockMealRepository } from "@/services/mock";

describe("time-zone-aware day grouping", () => {
  it("places the same instant on the correct local day", () => {
    const instant = "2026-07-27T02:30:00.000Z";
    expect(dayKey(instant, "America/Toronto")).toBe("2026-07-26");
    expect(dayKey(instant, "Asia/Tokyo")).toBe("2026-07-27");
  });

  it("groups meals with the profile time zone", async () => {
    const meals = await new MockMealRepository().listMeals();
    const grouped = groupMealsByDay(meals, "America/Toronto");
    expect(Object.values(grouped).flat()).toHaveLength(meals.length);
  });
});
