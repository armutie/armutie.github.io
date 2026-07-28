import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { SavedMeal } from "@/domain";

export function dayKey(isoDate: string, timeZone: string) {
  return formatInTimeZone(isoDate, timeZone, "yyyy-MM-dd");
}

export function todayKey(timeZone: string, now = new Date()) {
  return formatInTimeZone(now, timeZone, "yyyy-MM-dd");
}

export function groupMealsByDay(meals: SavedMeal[], timeZone: string) {
  return meals.reduce<Record<string, SavedMeal[]>>((groups, meal) => {
    const key = dayKey(meal.consumedAt, timeZone);
    groups[key] = [...(groups[key] ?? []), meal];
    return groups;
  }, {});
}

export function dateInputToIso(date: string, time: string, timeZone: string) {
  return fromZonedTime(`${date}T${time}:00`, timeZone).toISOString();
}

export function displayDay(key: string, timeZone: string) {
  return formatInTimeZone(`${key}T12:00:00Z`, timeZone, "EEEE, MMMM d");
}
