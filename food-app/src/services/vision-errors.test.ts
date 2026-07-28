import { describe, expect, it } from "vitest";
import { serviceErrorMessage } from "@/services/errors";
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

  it("preserves and displays the deployed request correlation ID", () => {
    const error = createVisionServiceError(
      "provider-configuration",
      new Error("provider failure"),
      "e7f3be34-8fd3-4d3c-9d44-6a4605649858",
    );

    expect(error.requestId).toBe("e7f3be34-8fd3-4d3c-9d44-6a4605649858");
    expect(serviceErrorMessage(error)).toContain(
      "Reference: e7f3be34-8fd3-4d3c-9d44-6a4605649858.",
    );
  });
});
