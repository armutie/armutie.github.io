export type ReferenceDefinition = {
  label: string;
  widthMm: number | null;
  heightMm: number | null;
  shape: "none" | "circle" | "rectangle";
  approximateWidthRangeMm?: readonly [number, number];
  approximateHeightRangeMm?: readonly [number, number];
};

export const REFERENCE_OBJECTS: Record<string, ReferenceDefinition> = {
  none: { label: "No reference object", widthMm: null, heightMm: null, shape: "none" },
  canadian_loonie: { label: "Canadian loonie", widthMm: 26.5, heightMm: 26.5, shape: "circle" },
  canadian_toonie: { label: "Canadian toonie", widthMm: 28, heightMm: 28, shape: "circle" },
  phone: {
    label: "Phone",
    widthMm: null,
    heightMm: null,
    shape: "rectangle",
    approximateWidthRangeMm: [68, 80],
    approximateHeightRangeMm: [140, 165],
  },
  iphone_15: { label: "iPhone 15", widthMm: 71.6, heightMm: 147.6, shape: "rectangle" },
  iphone_15_pro: { label: "iPhone 15 Pro", widthMm: 70.6, heightMm: 146.6, shape: "rectangle" },
  iphone_15_pro_max: { label: "iPhone 15 Pro Max", widthMm: 76.7, heightMm: 159.9, shape: "rectangle" },
};
