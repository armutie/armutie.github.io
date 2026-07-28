import { ChevronRight, Clock3 } from "lucide-react";
import type { SavedMeal } from "@/domain";
import { sumNutrients } from "@/lib/nutrition";
import { formatNumber } from "@/lib/utils";
import { HashLink } from "@/lib/router";

export function MealRow({ meal, timeZone }: { meal: SavedMeal; timeZone: string }) {
  const total = sumNutrients(meal.items);
  const time = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(meal.consumedAt));

  return (
    <HashLink to={`/meal/${meal.id}`} className="meal-row">
      <div className="meal-thumbnail">
        {meal.imagePreviewUrl ? (
          <img src={meal.imagePreviewUrl} alt="" />
        ) : (
          <span>{meal.name.charAt(0)}</span>
        )}
      </div>
      <div className="meal-row-copy">
        <strong>{meal.name}</strong>
        <span>
          <Clock3 size={14} aria-hidden="true" />
          {time} · {meal.items.length} items
        </span>
      </div>
      <div className="meal-row-energy">
        <strong>{formatNumber(total.calories)}</strong>
        <span>kcal</span>
      </div>
      <ChevronRight size={19} className="meal-row-arrow" aria-hidden="true" />
    </HashLink>
  );
}
