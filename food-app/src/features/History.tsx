import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { MealRow } from "@/components/MealRow";
import { NutrientSummary } from "@/components/NutrientSummary";
import { Button } from "@/components/ui/button";
import { useApp } from "@/app-context";
import { displayDay, groupMealsByDay, todayKey } from "@/lib/dates";
import { EMPTY_NUTRIENTS } from "@/domain";
import { sumNutrients } from "@/lib/nutrition";

export function History() {
  const { services } = useApp();
  const meals = useQuery({ queryKey: ["meals"], queryFn: () => services.meals.listMeals() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => services.meals.getProfile() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const timeZone = profile.data?.timeZone ?? "America/Toronto";
  const day = selectedDate ?? todayKey(timeZone);
  const grouped = useMemo(() => groupMealsByDay(meals.data ?? [], timeZone), [meals.data, timeZone]);
  const dayMeals = grouped[day] ?? [];
  const totals = dayMeals.reduce(
    (sum, meal) => {
      const values = sumNutrients(meal.items);
      for (const key of Object.keys(sum) as Array<keyof typeof sum>) sum[key] += values[key];
      return sum;
    },
    { ...EMPTY_NUTRIENTS },
  );

  const changeDay = (offset: number) => {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() + offset);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  if (meals.isLoading || profile.isLoading) return <div className="loading-block" style={{ height: 380 }} />;

  return (
    <>
      <div className="page-heading history-heading">
        <div>
          <p className="eyebrow">Meal journal</p>
          <h1>History</h1>
        </div>
        <label className="date-picker">
          <span className="sr-only">Choose date</span>
          <input type="date" value={day} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
      </div>

      <div className="day-nav">
        <Button variant="secondary" size="icon" onClick={() => changeDay(-1)} aria-label="Previous day"><ChevronLeft /></Button>
        <strong>{displayDay(day, timeZone)}</strong>
        <Button variant="secondary" size="icon" onClick={() => changeDay(1)} aria-label="Next day"><ChevronRight /></Button>
      </div>

      {dayMeals.length ? (
        <>
          <section className="paper-panel daily-summary">
            <p>Daily total</p>
            <NutrientSummary values={totals} compact />
          </section>
          <div className="section-heading"><h2>{dayMeals.length} {dayMeals.length === 1 ? "meal" : "meals"}</h2></div>
          <div className="meal-list">
            {dayMeals.map((meal) => <MealRow key={meal.id} meal={meal} timeZone={timeZone} />)}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Utensils /></div>
          <h2>Nothing recorded</h2>
          <p>No meals were saved on this day.</p>
        </div>
      )}
    </>
  );
}
