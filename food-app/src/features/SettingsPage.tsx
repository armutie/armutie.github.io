import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useApp } from "@/app-context";
import type { Profile } from "@/domain";

const targetSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  timeZone: z.string().min(1),
  calories: z.number().min(0).max(10000),
  protein: z.number().min(0).max(1000),
  carbohydrates: z.number().min(0).max(1000),
  sugar: z.number().min(0).max(1000),
  fat: z.number().min(0).max(1000),
  fibre: z.number().min(0).max(1000),
});

export function SettingsPage() {
  const { services } = useApp();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => services.meals.getProfile() });
  const mutation = useMutation({
    mutationFn: (value: Profile) => services.meals.updateProfile(value),
    onSuccess: (data) => queryClient.setQueryData(["profile"], data),
  });

  if (!profile.data) return <div className="loading-block" style={{ height: 380 }} />;
  return <SettingsForm key={profile.data.id} profile={profile.data} onSave={mutation.mutateAsync} saved={mutation.isSuccess} />;
}

function SettingsForm({
  profile,
  onSave,
  saved,
}: {
  profile: Profile;
  onSave: (profile: Profile) => Promise<Profile>;
  saved: boolean;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof targetSchema>>({
    resolver: zodResolver(targetSchema),
    defaultValues: { displayName: profile.displayName, timeZone: profile.timeZone, ...profile.dailyTargets },
  });
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">Personalize your day</p><h1>Targets</h1></div>
      </div>
      <form
        className="paper-panel settings-form"
        onSubmit={handleSubmit(async (values) => {
          await onSave({
            ...profile,
            displayName: values.displayName,
            timeZone: values.timeZone,
            dailyTargets: {
              calories: values.calories,
              protein: values.protein,
              carbohydrates: values.carbohydrates,
              sugar: values.sugar,
              fat: values.fat,
              fibre: values.fibre,
            },
          });
        })}
      >
        <p>Targets are optional context, not recommendations. Enter values that are appropriate for you.</p>
        <div className="field"><label htmlFor="displayName">Display name</label><input id="displayName" {...register("displayName")} /></div>
        <div className="field"><label htmlFor="timeZone">Time zone</label><input id="timeZone" {...register("timeZone")} /><small>Meals are grouped into days using this IANA time zone.</small></div>
        <div className="target-fields">
          {(["calories", "protein", "carbohydrates", "fat", "sugar", "fibre"] as const).map((key) => (
            <div className="field" key={key}>
              <label htmlFor={key}>{key.charAt(0).toUpperCase() + key.slice(1)} {key !== "calories" && "(g)"}</label>
              <input id={key} type="number" min="0" step={key === "calories" ? "10" : "1"} {...register(key, { valueAsNumber: true })} />
              {errors[key] && <p className="field-error">{errors[key]?.message}</p>}
            </div>
          ))}
        </div>
        <Button type="submit" disabled={isSubmitting}>{saved ? <><Check size={18} /> Saved</> : "Save targets"}</Button>
      </form>
    </>
  );
}
