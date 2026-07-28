import { describe, expect, it } from "vitest";
import { createVisionServiceError } from "@/services/supabase";

describe("vision provider error handling", () => {
  it.each([
    [
      "provider-configuration",
      "vision-configuration",
      "Meal analysis needs a server configuration fix. Try again later.",
    ],
    [
      "provider-quota",
      "vision-quota",
      "The AI service has reached its current quota. Try again later.",
    ],
    [
      "unavailable",
      "vision-unavailable",
      "The AI service is temporarily unavailable. Try again shortly.",
    ],
    [
      "upload",
      "upload",
      "The meal photo could not be prepared on the server. Try uploading it again.",
    ],
  ])("maps %s to an actionable client error", (providerCode, code, message) => {
    expect(createVisionServiceError(providerCode, new Error("provider failure"))).toMatchObject({
      code,
      message,
    });
  });
});
