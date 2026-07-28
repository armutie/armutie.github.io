import { z } from "zod";

export const referenceObjectTypes = [
  "none",
  "canadian_loonie",
  "canadian_toonie",
  "phone",
  "iphone_15",
  "iphone_15_pro",
  "iphone_15_pro_max",
  "custom",
] as const;

export const referenceObjectTypeSchema = z.enum(referenceObjectTypes);
export type ReferenceObjectType = z.infer<typeof referenceObjectTypeSchema>;

export type ReferenceObjectDefinition = {
  type: Exclude<ReferenceObjectType, "custom">;
  label: string;
  widthMm: number | null;
  heightMm: number | null;
  shape: "none" | "circle" | "rectangle";
  approximateWidthRangeMm?: readonly [number, number];
  approximateHeightRangeMm?: readonly [number, number];
};

export const REFERENCE_OBJECTS: Record<Exclude<ReferenceObjectType, "custom">, ReferenceObjectDefinition> = {
  none: {
    type: "none",
    label: "No reference object",
    widthMm: null,
    heightMm: null,
    shape: "none",
  },
  canadian_loonie: {
    type: "canadian_loonie",
    label: "Canadian loonie",
    widthMm: 26.5,
    heightMm: 26.5,
    shape: "circle",
  },
  canadian_toonie: {
    type: "canadian_toonie",
    label: "Canadian toonie",
    widthMm: 28,
    heightMm: 28,
    shape: "circle",
  },
  phone: {
    type: "phone",
    label: "Phone (approximate)",
    widthMm: null,
    heightMm: null,
    shape: "rectangle",
    approximateWidthRangeMm: [68, 80],
    approximateHeightRangeMm: [140, 165],
  },
  iphone_15: {
    type: "iphone_15",
    label: "iPhone 15",
    widthMm: 71.6,
    heightMm: 147.6,
    shape: "rectangle",
  },
  iphone_15_pro: {
    type: "iphone_15_pro",
    label: "iPhone 15 Pro",
    widthMm: 70.6,
    heightMm: 146.6,
    shape: "rectangle",
  },
  iphone_15_pro_max: {
    type: "iphone_15_pro_max",
    label: "iPhone 15 Pro Max",
    widthMm: 76.7,
    heightMm: 159.9,
    shape: "rectangle",
  },
};

export const selectedReferenceSchema = z
  .object({
    type: referenceObjectTypeSchema,
    customLabel: z.string().trim().max(80).optional(),
    customWidthMm: z.coerce.number().min(1).max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "custom" && !value.customWidthMm) {
      context.addIssue({
        code: "custom",
        path: ["customWidthMm"],
        message: "Enter the known width or diameter.",
      });
    }
  });

export type SelectedReference = z.infer<typeof selectedReferenceSchema>;

export function getReferenceDimensions(selection: SelectedReference) {
  if (selection.type === "custom") {
    return {
      label: selection.customLabel || "Custom reference object",
      widthMm: selection.customWidthMm ?? null,
      heightMm: null,
    };
  }

  return REFERENCE_OBJECTS[selection.type];
}
