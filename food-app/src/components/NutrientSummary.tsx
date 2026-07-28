import type { Nutrients } from "@/domain";
import { formatNumber } from "@/lib/utils";

const nutrientMeta: Array<{
  key: keyof Nutrients;
  shortLabel: string;
  label: string;
  unit: string;
  className: string;
}> = [
  { key: "calories", shortLabel: "kcal", label: "Calories", unit: "", className: "nutrient-calories" },
  { key: "protein", shortLabel: "Protein", label: "Protein", unit: "g", className: "nutrient-protein" },
  {
    key: "carbohydrates",
    shortLabel: "Carbs",
    label: "Carbohydrates",
    unit: "g",
    className: "nutrient-carbs",
  },
  { key: "fat", shortLabel: "Fat", label: "Total fat", unit: "g", className: "nutrient-fat" },
  { key: "sugar", shortLabel: "Sugar", label: "Total sugar", unit: "g", className: "nutrient-sugar" },
  { key: "fibre", shortLabel: "Fibre", label: "Dietary fibre", unit: "g", className: "nutrient-fibre" },
];

type NutrientSummaryProps = {
  values: Nutrients;
  targets?: Nutrients;
  compact?: boolean;
};

export function NutrientSummary({ values, targets, compact = false }: NutrientSummaryProps) {
  return (
    <div className={compact ? "nutrient-grid compact" : "nutrient-grid"}>
      {nutrientMeta.map((meta) => {
        const target = targets?.[meta.key];
        const hasTarget = typeof target === "number" && target > 0;
        const percent = hasTarget ? Math.min((values[meta.key] / target) * 100, 100) : 0;
        return (
          <div className={`nutrient-stat ${meta.className}`} key={meta.key}>
            <div className="nutrient-stat-top">
              <span>{compact ? meta.shortLabel : meta.label}</span>
              <strong>
                {formatNumber(values[meta.key], meta.key === "calories" ? 0 : 1)}
                {meta.unit}
              </strong>
            </div>
            {targets && hasTarget && (
              <>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`${meta.label}: ${formatNumber(values[meta.key])} of ${target}${meta.unit}`}
                  aria-valuenow={values[meta.key]}
                  aria-valuemin={0}
                  aria-valuemax={target}
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
                {!compact && (
                  <small>
                    {formatNumber(Math.max(target - values[meta.key], 0))}{meta.unit} remaining
                  </small>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
