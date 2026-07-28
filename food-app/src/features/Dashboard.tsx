import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Camera } from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import { MealRow } from "@/components/MealRow";
import { NutrientSummary } from "@/components/NutrientSummary";
import { Button } from "@/components/ui/button";
import { useApp } from "@/app-context";
import { sumNutrients } from "@/lib/nutrition";
import { todayKey, dayKey } from "@/lib/dates";
import { EMPTY_NUTRIENTS } from "@/domain";
import { formatNumber } from "@/lib/utils";
import { HashLink, navigate } from "@/lib/router";

export function Dashboard() {
  const { services } = useApp();
  const mealsQuery = useQuery({ queryKey: ["meals"], queryFn: () => services.meals.listMeals() });
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => services.meals.getProfile() });

  if (mealsQuery.isLoading || profileQuery.isLoading) return <DashboardSkeleton />;
  if (mealsQuery.isError || profileQuery.isError || !profileQuery.data) {
    return <DashboardError onRetry={() => { void mealsQuery.refetch(); void profileQuery.refetch(); }} />;
  }

  const profile = profileQuery.data;
  const today = todayKey(profile.timeZone);
  const todayMeals = (mealsQuery.data ?? []).filter((meal) => dayKey(meal.consumedAt, profile.timeZone) === today);
  const totals = todayMeals.reduce(
    (sum, meal) => {
      const mealTotal = sumNutrients(meal.items);
      for (const key of Object.keys(sum) as Array<keyof typeof sum>) sum[key] += mealTotal[key];
      return sum;
    },
    { ...EMPTY_NUTRIENTS },
  );

  const greeting = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: profile.timeZone,
  }).format(new Date());

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{greeting}</p>
          <h1>Today’s plate</h1>
        </div>
      </div>

      <section className="hero-total" aria-labelledby="today-total-heading">
        <div className="hero-total-header">
          <div>
            <p id="today-total-heading">Daily energy estimate</p>
            <strong>{formatNumber(totals.calories)} <span>kcal</span></strong>
          </div>
          <Button onClick={() => navigate("/add")}>
            <Camera size={18} />
            Add meal
          </Button>
        </div>
        <NutrientSummary values={totals} targets={profile.dailyTargets} compact />
      </section>

      <div className="section-heading">
        <h2>Recent meals</h2>
        <HashLink to="/history">View history <ArrowRight size={14} /></HashLink>
      </div>
      {todayMeals.length ? (
        <div className="meal-list">
          {todayMeals.slice(0, 4).map((meal) => (
            <MealRow key={meal.id} meal={meal} timeZone={profile.timeZone} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><CalendarDays /></div>
          <h2>A fresh page</h2>
          <p>Add your first meal today, then review each estimate before saving it.</p>
          <HashLink to="/add" className="button button-primary">Add a meal</HashLink>
        </div>
      )}
      <Disclaimer />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="Loading today’s meals" aria-busy="true">
      <div className="loading-block" style={{ width: 230, height: 54, marginBottom: 20 }} />
      <div className="loading-block" style={{ height: 260, marginBottom: 28 }} />
      <div className="loading-block" style={{ width: 160, height: 30, marginBottom: 14 }} />
      <div className="loading-block" style={{ height: 78, marginBottom: 10 }} />
      <div className="loading-block" style={{ height: 78 }} />
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <div className="empty-state-icon"><CalendarDays /></div>
      <h2>Today could not be loaded</h2>
      <p>Check your connection and try again.</p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}
