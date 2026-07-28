import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { NutrientSummary } from "@/components/NutrientSummary";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useApp } from "@/app-context";
import { confidenceLabel, sumNutrients } from "@/lib/nutrition";
import type { EditableMealItem, Nutrients, SavedMeal } from "@/domain";
import { HashLink, navigate } from "@/lib/router";

export function MealDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { services } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editItems, setEditItems] = useState<EditableMealItem[] | null>(null);
  const meal = useQuery({ queryKey: ["meal", id], queryFn: () => services.meals.getMeal(id!), enabled: Boolean(id) });
  const remove = useMutation({
    mutationFn: () => services.meals.deleteMeal(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
      navigate("/history");
    },
  });
  const update = useMutation({
    mutationFn: (updatedMeal: SavedMeal) => services.meals.updateMeal(updatedMeal),
    onSuccess: async (updatedMeal) => {
      queryClient.setQueryData(["meal", id], updatedMeal);
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
      setEditItems(null);
    },
  });

  if (meal.isLoading) return <div className="loading-block" style={{ height: 500 }} />;
  if (!meal.data) return <div className="empty-state"><h2>Meal not found</h2><HashLink to="/history">Return to history</HashLink></div>;
  const data = meal.data;
  const totals = sumNutrients(data.items);

  return (
    <>
      <div className="detail-toolbar">
        <HashLink to="/history" className="button button-ghost"><ArrowLeft size={18} /> Back</HashLink>
        <div>
          <Button variant="secondary" onClick={() => setEditItems(structuredClone(data.items))}><Pencil size={17} /> Edit</Button>
          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Delete meal"><Trash2 size={19} /></Button>
        </div>
      </div>
      <article className="meal-detail">
        {data.imagePreviewUrl && <img className="meal-detail-photo" src={data.imagePreviewUrl} alt={`Photograph of ${data.name}`} />}
        <div className="meal-detail-heading">
          <p className="eyebrow">{new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short" }).format(new Date(data.consumedAt))}</p>
          <h1>{data.name}</h1>
          {data.notes && <p>{data.notes}</p>}
        </div>
        <section className="paper-panel meal-total-panel">
          <h2>Meal total</h2>
          <NutrientSummary values={totals} compact />
        </section>
        <section>
          <div className="section-heading"><h2>Foods</h2></div>
          <div className="detail-food-list">
            {data.items.map((item) => {
              const changed = item.aiDetectedName !== item.confirmedName ||
                item.aiEstimatedWeightGrams !== item.confirmedWeightGrams ||
                item.userState === "edited";
              return (
                <div className="food-card detail-food" key={item.id}>
                  <div className="detail-food-heading">
                    <div><h3>{item.confirmedName}</h3><p>{item.confirmedWeightGrams} g · {confidenceLabel(item.confidence)}</p></div>
                    {item.userState === "confirmed" ? <span className="state-note"><Check size={14} /> Confirmed</span> : changed && <span className="state-note"><Pencil size={14} /> Corrected</span>}
                  </div>
                  <NutrientSummary values={item.confirmedNutrients} compact />
                  {changed && <p className="original-note">Original estimate: {item.aiDetectedName}, {item.aiEstimatedWeightGrams} g. The original values remain stored.</p>}
                  {item.assumptions.length > 0 && <div className="assumption-note"><AlertTriangle size={16} /><span>{item.assumptions[0]}</span></div>}
                </div>
              );
            })}
          </div>
        </section>
      </article>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete this meal?" description="The meal, its items, and any retained photograph will be removed.">
        {remove.isError && <p className="form-error">The meal could not be deleted. Try again.</p>}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep meal</Button>
          <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash2 size={18} /> {remove.isPending ? "Deleting..." : "Delete meal"}</Button>
        </div>
      </Dialog>
      {editItems && (
        <MealEditDialog
          meal={data}
          items={editItems}
          onItemsChange={setEditItems}
          open
          onOpenChange={(open) => !open && setEditItems(null)}
          onSave={() => update.mutate({ ...data, items: editItems })}
          saving={update.isPending}
          error={update.isError}
        />
      )}
    </>
  );
}

function MealEditDialog({
  meal,
  items,
  onItemsChange,
  open,
  onOpenChange,
  onSave,
  saving,
  error,
}: {
  meal: SavedMeal;
  items: EditableMealItem[];
  onItemsChange: (items: EditableMealItem[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  saving: boolean;
  error: boolean;
}) {
  const nutrientFields: Array<{ key: keyof Nutrients; label: string }> = [
    { key: "calories", label: "Calories" },
    { key: "protein", label: "Protein (g)" },
    { key: "carbohydrates", label: "Carbs (g)" },
    { key: "fat", label: "Fat (g)" },
    { key: "sugar", label: "Sugar (g)" },
    { key: "fibre", label: "Fibre (g)" },
  ];
  const change = (id: string, updater: (item: EditableMealItem) => EditableMealItem) => {
    onItemsChange(items.map((item) => item.id === id ? updater(item) : item));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Edit ${meal.name}`} description="These changes are stored alongside the original AI estimate.">
      <div className="detail-edit-list">
        {items.map((item) => (
          <section key={item.id}>
            <div className="detail-edit-heading">
              <div className="field">
                <label htmlFor={`edit-name-${item.id}`}>Food</label>
                <input id={`edit-name-${item.id}`} value={item.confirmedName} onChange={(event) => change(item.id, (current) => ({ ...current, confirmedName: event.target.value, userState: "edited" }))} />
              </div>
              <div className="field">
                <label htmlFor={`edit-weight-${item.id}`}>Weight (g)</label>
                <input id={`edit-weight-${item.id}`} type="number" min="1" value={item.confirmedWeightGrams} onChange={(event) => change(item.id, (current) => ({ ...current, confirmedWeightGrams: Math.max(1, Number(event.target.value)), userState: "edited" }))} />
              </div>
              <Button variant="ghost" size="icon" onClick={() => onItemsChange(items.filter((entry) => entry.id !== item.id))} aria-label={`Remove ${item.confirmedName}`}><Trash2 size={17} /></Button>
            </div>
            <div className="detail-edit-nutrients">
              {nutrientFields.map((field) => (
                <div className="field" key={field.key}>
                  <label htmlFor={`edit-${field.key}-${item.id}`}>{field.label}</label>
                  <input
                    id={`edit-${field.key}-${item.id}`}
                    type="number"
                    min="0"
                    step="0.1"
                    value={item.confirmedNutrients[field.key]}
                    onChange={(event) => change(item.id, (current) => ({
                      ...current,
                      confirmedNutrients: { ...current.confirmedNutrients, [field.key]: Math.max(0, Number(event.target.value)) },
                      nutrientOverride: true,
                      userState: "edited",
                    }))}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {error && <p className="form-error">Changes could not be saved. Try again.</p>}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={onSave} disabled={saving || items.length === 0}>{saving ? "Saving..." : "Save changes"}</Button>
      </div>
    </Dialog>
  );
}
