import { describe, expect, it } from "vitest";
import {
  getReferenceDimensions,
  REFERENCE_OBJECTS,
  selectedReferenceSchema,
} from "@/lib/reference-objects";

describe("reference object configuration", () => {
  it("keeps supported real-world dimensions in one typed map", () => {
    expect(REFERENCE_OBJECTS.canadian_loonie.widthMm).toBe(26.5);
    expect(REFERENCE_OBJECTS.canadian_toonie.widthMm).toBe(28);
    expect(REFERENCE_OBJECTS.phone.widthMm).toBeNull();
    expect(REFERENCE_OBJECTS.phone.approximateWidthRangeMm).toEqual([68, 80]);
    expect(REFERENCE_OBJECTS.iphone_15_pro.widthMm).toBe(70.6);
  });

  it("requires a known size for custom objects", () => {
    expect(selectedReferenceSchema.safeParse({ type: "custom" }).success).toBe(false);
    expect(getReferenceDimensions({
      type: "custom",
      customLabel: "Coaster",
      customWidthMm: 92,
    }).widthMm).toBe(92);
  });
});
