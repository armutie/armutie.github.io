import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  Info,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApp } from "@/app-context";
import { NutrientSummary } from "@/components/NutrientSummary";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  EMPTY_NUTRIENTS,
  mealDraftSchema,
  type EditableMealItem,
  type MealAnalysisInput,
  type MealAnalysisResult,
  type MealDraft,
  type NutritionMatch,
  type Nutrients,
} from "@/domain";
import { dateInputToIso } from "@/lib/dates";
import { blobToDataUrl, ImageValidationError, prepareImage } from "@/lib/image";
import {
  referenceObjectTypeSchema,
  type ReferenceObjectType,
} from "@/lib/reference-objects";
import {
  analysisFoodToEditable,
  calculateForWeight,
  confidenceLabel,
  recalculateItem,
  sumNutrients,
} from "@/lib/nutrition";
import { createId, formatNumber } from "@/lib/utils";
import { serviceErrorMessage } from "@/services/errors";
import { navigate } from "@/lib/router";

const setupSchema = z
  .object({
    name: z.string().trim().min(1, "Name this meal.").max(100),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    date: z.string().min(1),
    time: z.string().min(1),
    knownIngredients: z.string().max(1000),
    notes: z.string().max(1000),
    imageRetention: z.enum(["retain", "delete_after_analysis"]),
    referenceType: referenceObjectTypeSchema,
    customLabel: z.string().max(80),
    customWidthMm: z.number().min(1).max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (value.referenceType === "custom" && !value.customWidthMm) {
      context.addIssue({
        code: "custom",
        path: ["customWidthMm"],
        message: "Enter a known width or diameter.",
      });
    }
  });

type SetupValues = z.infer<typeof setupSchema>;
type FlowPhase = "setup" | "analyzing" | "review";

type PreparedPhoto = {
  file: File;
  previewUrl: string;
  dataUrl: string;
  isSample: boolean;
};

export function AddMealFlow() {
  const { services } = useApp();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<FlowPhase>("setup");
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [analysis, setAnalysis] = useState<MealAnalysisResult | null>(null);
  const [items, setItems] = useState<EditableMealItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [analysisMessageIndex, setAnalysisMessageIndex] = useState(0);
  const clientRequestId = useRef(crypto.randomUUID());
  const fileInput = useRef<HTMLInputElement>(null);

  const now = new Date();
  const defaultMealType = now.getHours() < 11 ? "breakfast" : now.getHours() < 15 ? "lunch" : now.getHours() < 21 ? "dinner" : "snack";
  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      name: `${defaultMealType.charAt(0).toUpperCase()}${defaultMealType.slice(1)}`,
      mealType: defaultMealType,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      knownIngredients: "",
      notes: "",
      imageRetention: "retain",
      referenceType: "none",
      customLabel: "",
      customWidthMm: undefined,
    },
  });

  const analysisMutation = useMutation({
    mutationFn: (input: MealAnalysisInput) => services.vision.analyzeMeal(input),
    onSuccess: (result) => {
      setAnalysis(result);
      setItems(result.foods.map(analysisFoodToEditable));
      setPhase("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (draft: MealDraft) => services.meals.saveMeal(draft),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["meals"] });
      navigate(`/meal/${saved.id}`, true);
    },
  });

  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = window.setInterval(() => {
      setAnalysisMessageIndex((index) => Math.min(index + 1, 2));
    }, 1200);
    return () => window.clearInterval(timer);
  }, [phase]);

  const choosePhoto = async (file: File, isSample = false) => {
    setPhotoError("");
    try {
      const prepared = await prepareImage(file);
      const dataUrl = await blobToDataUrl(prepared);
      setPhoto((current) => {
        if (current && !current.isSample) URL.revokeObjectURL(current.previewUrl);
        return {
          file: prepared,
          previewUrl: isSample ? `${import.meta.env.BASE_URL}demo-meal.png` : URL.createObjectURL(prepared),
          dataUrl,
          isSample,
        };
      });
    } catch (error) {
      setPhotoError(error instanceof ImageValidationError ? error.message : "The photo could not be prepared.");
    }
  };

  const loadSample = async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}demo-meal.png`);
    const blob = await response.blob();
    await choosePhoto(new File([blob], "demo-meal.png", { type: "image/png" }), true);
    form.setValue("referenceType", "canadian_loonie");
    form.setValue("name", "Herb chicken plate");
    form.setValue("mealType", "lunch");
  };

  const startAnalysis = form.handleSubmit(async (values) => {
    if (!photo) {
      setPhotoError("Take a photo or choose one from your library.");
      return;
    }
    setPhase("analyzing");
    setAnalysisMessageIndex(0);
    await analysisMutation.mutateAsync({
      image: photo.file,
      imageDataUrl: photo.dataUrl,
      fileName: photo.file.name,
      mimeType: photo.file.type,
      reference: {
        type: values.referenceType,
        customLabel: values.customLabel || undefined,
        customWidthMm: values.customWidthMm,
      },
      mealType: values.mealType,
      knownIngredients: values.knownIngredients,
      imageRetention: values.imageRetention,
    }).catch(() => setPhase("setup"));
  });

  const saveMeal = async () => {
    if (!analysis || !photo) return;
    const values = form.getValues();
    const profile = await services.meals.getProfile();
    const draft = mealDraftSchema.parse({
      clientRequestId: clientRequestId.current,
      name: values.name,
      mealType: values.mealType,
      consumedAt: dateInputToIso(values.date, values.time, profile.timeZone),
      notes: values.notes,
      knownIngredients: values.knownIngredients,
      reference: {
        type: values.referenceType,
        customLabel: values.customLabel || undefined,
        customWidthMm: values.customWidthMm,
      },
      imageRetention: values.imageRetention,
      imagePreviewUrl: values.imageRetention === "retain" ? photo.previewUrl : null,
      imagePath: values.imageRetention === "retain" ? analysis.imagePath ?? null : null,
      analysis,
      items,
      followUpAnswers: answers,
    } satisfies MealDraft);
    await saveMutation.mutateAsync(draft);
  };

  if (phase === "analyzing" && photo) {
    return <AnalysisState photoUrl={photo.previewUrl} messageIndex={analysisMessageIndex} />;
  }

  if (phase === "review" && analysis && photo) {
    return (
      <ReviewStep
        analysis={analysis}
        items={items}
        onItemsChange={setItems}
        answers={answers}
        onAnswersChange={setAnswers}
        photoUrl={photo.previewUrl}
        mealName={form.getValues("name")}
        onBack={() => setPhase("setup")}
        onSave={() => void saveMeal()}
        saving={saveMutation.isPending}
        saveError={saveMutation.isError ? serviceErrorMessage(saveMutation.error) : ""}
      />
    );
  }

  return (
    <section className="add-flow">
      <div className="page-heading">
        <div><p className="eyebrow">New meal</p><h1>Show us your plate</h1></div>
        <span className="step-count">1 of 2</span>
      </div>

      <div className="add-layout">
        <section className="photo-panel">
          {photo ? (
            <div className="photo-preview">
              <img src={photo.previewUrl} alt="Meal ready for analysis" />
              <div className="photo-actions">
                <Button variant="secondary" onClick={() => fileInput.current?.click()}><RefreshCw size={17} /> Replace</Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Remove photo"
                  onClick={() => {
                    if (!photo.isSample) URL.revokeObjectURL(photo.previewUrl);
                    setPhoto(null);
                  }}
                ><Trash2 size={18} /></Button>
              </div>
            </div>
          ) : (
            <div className="photo-drop">
              <div className="photo-drop-icon"><ImagePlus size={28} /></div>
              <h2>Add a clear meal photo</h2>
              <p>Photograph from above when possible, with the whole plate in frame.</p>
              <div className="photo-choice-actions">
                <Button onClick={() => fileInput.current?.click()}><Camera size={18} /> Take or choose photo</Button>
                {services.mode === "demo" && <Button variant="secondary" onClick={() => void loadSample()}><Sparkles size={18} /> Use demo plate</Button>}
              </div>
            </div>
          )}
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void choosePhoto(file);
              event.currentTarget.value = "";
            }}
          />
          {photoError && <p className="photo-error" role="alert"><AlertTriangle size={17} /> {photoError}</p>}
          <p className="photo-support"><Upload size={15} /> JPEG, PNG, WebP, HEIC or HEIF · up to 20 MB</p>
        </section>

        <form className="setup-panel" onSubmit={startAnalysis} noValidate>
          <div className="setup-section">
            <h2>Meal details</h2>
            <div className="field-row">
              <div className="field"><label htmlFor="mealName">Meal name</label><input id="mealName" {...form.register("name")} />{form.formState.errors.name && <p className="field-error">{form.formState.errors.name.message}</p>}</div>
              <div className="field"><label htmlFor="mealType">Type</label><select id="mealType" {...form.register("mealType")}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></div>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="mealDate">Date</label><input id="mealDate" type="date" {...form.register("date")} /></div>
              <div className="field"><label htmlFor="mealTime">Time</label><input id="mealTime" type="time" {...form.register("time")} /></div>
            </div>
            <div className="field"><label htmlFor="knownIngredients">Known ingredients <span>(optional)</span></label><textarea id="knownIngredients" rows={2} placeholder="e.g. chicken thigh, olive oil, Greek yogurt" {...form.register("knownIngredients")} /><small>Add details the camera cannot see, such as oil or sauce ingredients.</small></div>
          </div>

          <fieldset className="setup-section reference-fieldset">
            <legend>Size reference</legend>
            <p>A familiar object can improve approximate scale. Keep it beside the food on the same plane.</p>
            <ReferencePicker value={form.watch("referenceType")} onChange={(value) => form.setValue("referenceType", value)} />
            {form.watch("referenceType") === "custom" && (
              <div className="custom-reference">
                <div className="field"><label htmlFor="customLabel">Object name</label><input id="customLabel" placeholder="e.g. coaster" {...form.register("customLabel")} /></div>
                <div className="field"><label htmlFor="customWidth">Known width or diameter (mm)</label><input id="customWidth" type="number" min="1" step="0.1" {...form.register("customWidthMm", { setValueAs: (value) => value === "" ? undefined : Number(value) })} />{form.formState.errors.customWidthMm && <p className="field-error">{form.formState.errors.customWidthMm.message}</p>}</div>
              </div>
            )}
            <div className="reference-limit"><Info size={16} /><span>A reference cannot reveal hidden depth, ingredients, internal density, exact oil or sauce, or food beneath other food.</span></div>
          </fieldset>

          <fieldset className="setup-section privacy-fieldset">
            <legend>Photo privacy</legend>
            <label className="choice-row"><input type="radio" value="retain" {...form.register("imageRetention")} /><span><strong>Save photo with meal</strong><small>Keep the compressed image in private storage.</small></span></label>
            <label className="choice-row"><input type="radio" value="delete_after_analysis" {...form.register("imageRetention")} /><span><strong>Delete after analysis</strong><small>Remove the stored image after analysis and save meal data only.</small></span></label>
          </fieldset>

          {analysisMutation.isError && <div className="analysis-error" role="alert"><AlertTriangle /><div><strong>Analysis did not finish</strong><p>{serviceErrorMessage(analysisMutation.error)}</p></div></div>}
          <Button type="submit" className="analyze-button" disabled={!photo || analysisMutation.isPending}><Sparkles size={19} /> Analyze meal</Button>
          <p className="estimate-note">AI results are estimates. You will review and correct every item before saving.</p>
        </form>
      </div>
    </section>
  );
}

function ReferencePicker({ value, onChange }: { value: ReferenceObjectType; onChange: (value: ReferenceObjectType) => void }) {
  const compactOptions: Array<{ type: ReferenceObjectType; label: string; detail: string }> = [
    { type: "none", label: "None", detail: "No scale cue" },
    { type: "canadian_loonie", label: "Loonie", detail: "26.5 mm" },
    { type: "canadian_toonie", label: "Toonie", detail: "28.0 mm" },
    { type: "iphone_15", label: "iPhone 15", detail: "71.6 mm wide" },
    { type: "iphone_15_pro", label: "15 Pro", detail: "70.6 mm wide" },
    { type: "iphone_15_pro_max", label: "15 Pro Max", detail: "76.7 mm wide" },
    { type: "custom", label: "Custom", detail: "Known size" },
  ];
  return (
    <div className="reference-options" role="radiogroup" aria-label="Reference object">
      {compactOptions.map((option) => (
        <button
          type="button"
          key={option.type}
          role="radio"
          aria-checked={value === option.type}
          className={value === option.type ? "reference-option selected" : "reference-option"}
          onClick={() => onChange(option.type)}
        >
          <span>{option.label}</span><small>{option.detail}</small>
          {value === option.type && <Check size={16} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

function AnalysisState({ photoUrl, messageIndex }: { photoUrl: string; messageIndex: number }) {
  const messages = [
    { title: "Identifying foods", detail: "Looking at visible ingredients and how the plate is arranged." },
    { title: "Estimating portions", detail: "Using visible scale cues and noting what cannot be seen." },
    { title: "Finding nutrition matches", detail: "Comparing likely foods with nutrition-database records." },
  ];
  return (
    <section className="analysis-state" aria-live="polite" aria-busy="true">
      <div className="analysis-photo"><img src={photoUrl} alt="Meal being analyzed" /><span className="scan-line" /></div>
      <div className="analysis-copy">
        <div className="analysis-orbit"><Sparkles /><span /></div>
        <p className="eyebrow">Working through the plate</p>
        <h1>{messages[messageIndex].title}</h1>
        <p>{messages[messageIndex].detail}</p>
        <div className="analysis-steps">
          {messages.map((message, index) => (
            <div key={message.title} className={index < messageIndex ? "complete" : index === messageIndex ? "active" : ""}>
              <span>{index < messageIndex ? <Check size={14} /> : index + 1}</span>{message.title}
            </div>
          ))}
        </div>
        <small>No artificial percentage: completion time depends on the image and provider.</small>
      </div>
    </section>
  );
}

type ReviewStepProps = {
  analysis: MealAnalysisResult;
  items: EditableMealItem[];
  onItemsChange: (items: EditableMealItem[]) => void;
  answers: Record<string, string>;
  onAnswersChange: (answers: Record<string, string>) => void;
  photoUrl: string;
  mealName: string;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string;
};

function ReviewStep(props: ReviewStepProps) {
  const { services } = useApp();
  const totals = sumNutrients(props.items);
  const [expandedId, setExpandedId] = useState(props.items[0]?.id ?? "");
  const [searchingItem, setSearchingItem] = useState<EditableMealItem | null>(null);

  const updateItem = (id: string, update: (item: EditableMealItem) => EditableMealItem) => {
    props.onItemsChange(props.items.map((item) => item.id === id ? update(item) : item));
  };

  const addManualItem = () => {
    const item: EditableMealItem = {
      id: createId("item"),
      temporaryId: createId("manual"),
      aiDetectedName: "Manually added food",
      confirmedName: "New food",
      aiEstimatedWeightGrams: 100,
      confirmedWeightGrams: 100,
      minimumWeightGrams: 100,
      maximumWeightGrams: 100,
      confidence: 1,
      nutritionMatch: null,
      originalNutrients: { ...EMPTY_NUTRIENTS },
      confirmedNutrients: { ...EMPTY_NUTRIENTS },
      assumptions: [],
      uncertaintyNotes: ["Added manually by the user."],
      userState: "added",
      nutrientOverride: true,
    };
    props.onItemsChange([...props.items, item]);
    setExpandedId(item.id);
  };

  return (
    <section className="review-step">
      <div className="review-header">
        <Button variant="ghost" onClick={props.onBack}><ArrowLeft size={18} /> Back</Button>
        <span className="step-count">2 of 2</span>
      </div>
      <div className="review-title">
        <div><p className="eyebrow">Review the estimate</p><h1>{props.mealName}</h1><p>Confirm what looks right and correct what does not. Nothing is saved yet.</p></div>
        <img src={props.photoUrl} alt="" />
      </div>

      <section className="review-total">
        <div><span>Current meal estimate</span><strong>{formatNumber(totals.calories)} <small>kcal</small></strong></div>
        <NutrientSummary values={totals} compact />
      </section>

      {analysisWarnings(props.analysis)}

      {props.analysis.followUpQuestions.length > 0 && (
        <section className="followup-section">
          <div className="followup-heading"><Sparkles size={18} /><div><h2>A detail that would help</h2><p>Your answer can guide your corrections below.</p></div></div>
          {props.analysis.followUpQuestions.map((question) => (
            <fieldset key={question.id}>
              <legend>{question.question}</legend>
              <div className="answer-options">
                {question.options.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={props.answers[question.id] === option ? "selected" : ""}
                    onClick={() => props.onAnswersChange({ ...props.answers, [question.id]: option })}
                  >{option}</button>
                ))}
              </div>
            </fieldset>
          ))}
        </section>
      )}

      <div className="section-heading review-food-heading"><h2>Foods on this plate</h2><span>{props.items.length} items</span></div>
      <div className="review-items">
        {props.items.map((item, index) => (
          <ReviewFoodCard
            key={item.id}
            item={item}
            index={index}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? "" : item.id)}
            onUpdate={(update) => updateItem(item.id, update)}
            onSearch={() => setSearchingItem(item)}
            onDuplicate={() => props.onItemsChange([...props.items.slice(0, index + 1), { ...structuredClone(item), id: createId("item"), temporaryId: createId("copy"), userState: "added" }, ...props.items.slice(index + 1)])}
            onRemove={() => props.onItemsChange(props.items.filter((entry) => entry.id !== item.id))}
          />
        ))}
      </div>
      <Button variant="secondary" className="add-food-button" onClick={addManualItem}><Plus size={18} /> Add missing food</Button>

      {props.saveError && <p className="form-error save-error" role="alert">{props.saveError}</p>}
      <div className="review-save-bar">
        <div><strong>{formatNumber(totals.calories)} kcal</strong><span>{props.items.length} foods reviewed</span></div>
        <Button onClick={props.onSave} disabled={props.saving || props.items.length === 0}>
          {props.saving ? <><LoaderCircle className="spin" size={19} /> Saving...</> : <><Check size={19} /> Save meal</>}
        </Button>
      </div>

      {searchingItem && (
        <NutritionSearchDialog
          item={searchingItem}
          open
          onOpenChange={(open) => !open && setSearchingItem(null)}
          search={(query) => services.nutrition.searchFoods(query)}
          onChoose={(match) => {
            updateItem(searchingItem.id, (item) => ({
              ...item,
              nutritionMatch: match,
              confirmedNutrients: calculateForWeight(match.nutrientsPer100g, item.confirmedWeightGrams),
              nutrientOverride: false,
              userState: item.userState === "added" ? "added" : "edited",
            }));
            setSearchingItem(null);
          }}
        />
      )}
    </section>
  );
}

function analysisWarnings(analysis: MealAnalysisResult) {
  return (
    <div className="analysis-summary">
      <div><strong>{confidenceLabel(analysis.overallConfidence)}</strong><span>overall identification confidence</span></div>
      <ul>{analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </div>
  );
}

type ReviewFoodCardProps = {
  item: EditableMealItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (update: (item: EditableMealItem) => EditableMealItem) => void;
  onSearch: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

function ReviewFoodCard({ item, index, expanded, onToggle, onUpdate, onSearch, onDuplicate, onRemove }: ReviewFoodCardProps) {
  const nutrientFields: Array<{ key: keyof Nutrients; label: string; unit: string; step: number }> = [
    { key: "calories", label: "Calories", unit: "kcal", step: 1 },
    { key: "protein", label: "Protein", unit: "g", step: 0.1 },
    { key: "carbohydrates", label: "Carbs", unit: "g", step: 0.1 },
    { key: "fat", label: "Fat", unit: "g", step: 0.1 },
    { key: "sugar", label: "Sugar", unit: "g", step: 0.1 },
    { key: "fibre", label: "Fibre", unit: "g", step: 0.1 },
  ];
  const sourceLabel = item.nutritionMatch?.source === "usda" ? "USDA FoodData Central" : item.nutritionMatch?.source === "mock" ? "Demo nutrition data" : "Manual values";

  return (
    <article className={`food-card ${expanded ? "expanded" : ""}`}>
      <button type="button" className="food-card-summary" onClick={onToggle} aria-expanded={expanded}>
        <span className="food-number">{index + 1}</span>
        <span className="food-summary-copy"><strong>{item.confirmedName}</strong><small>{item.confirmedWeightGrams} g · {confidenceLabel(item.confidence)}</small></span>
        <span className="food-summary-energy"><strong>{formatNumber(item.confirmedNutrients.calories)}</strong><small>kcal</small></span>
        {expanded ? <ChevronUp /> : <ChevronDown />}
      </button>
      {!expanded && <NutrientSummary values={item.confirmedNutrients} compact />}
      {expanded && (
        <div className="food-editor">
          <div className="field"><label htmlFor={`name-${item.id}`}>Food name</label><input id={`name-${item.id}`} value={item.confirmedName} onChange={(event) => onUpdate((current) => ({ ...current, confirmedName: event.target.value, userState: current.userState === "added" ? "added" : "edited" }))} /></div>
          <div className="weight-grid">
            <div className="field"><label htmlFor={`weight-${item.id}`}>Serving weight</label><div className="input-unit"><input id={`weight-${item.id}`} type="number" min="1" max="5000" value={item.confirmedWeightGrams} onChange={(event) => onUpdate((current) => recalculateItem(current, Math.max(Number(event.target.value), 1)))} /><span>g</span></div></div>
            <div className="range-note"><span>AI range</span><strong>{item.minimumWeightGrams}–{item.maximumWeightGrams} g</strong><small>Original: {item.aiEstimatedWeightGrams} g</small></div>
          </div>
          <div className="database-match">
            <div><span>Nutrition match</span><strong>{item.nutritionMatch?.description ?? "No database match"}</strong><small>{sourceLabel}{item.nutritionMatch?.uncertain ? " · uncertain match" : ""}</small></div>
            <Button variant="secondary" size="small" onClick={onSearch}><Search size={16} /> Change</Button>
          </div>
          <div className="editor-heading"><div><h3>Nutrient values</h3><p>{item.nutrientOverride ? "Manually overridden" : "Recalculates from the database match when weight changes"}</p></div>{item.nutrientOverride && item.nutritionMatch && <Button variant="ghost" size="small" onClick={() => onUpdate((current) => ({ ...current, nutrientOverride: false, confirmedNutrients: calculateForWeight(current.nutritionMatch!.nutrientsPer100g, current.confirmedWeightGrams) }))}>Use database values</Button>}</div>
          <div className="nutrient-editor-grid">
            {nutrientFields.map((field) => (
              <div className="field" key={field.key}>
                <label htmlFor={`${field.key}-${item.id}`}>{field.label}</label>
                <div className="input-unit">
                  <input
                    id={`${field.key}-${item.id}`}
                    type="number"
                    min="0"
                    step={field.step}
                    value={item.confirmedNutrients[field.key]}
                    onChange={(event) => onUpdate((current) => ({
                      ...current,
                      confirmedNutrients: { ...current.confirmedNutrients, [field.key]: Math.max(Number(event.target.value), 0) },
                      nutrientOverride: true,
                      userState: current.userState === "added" ? "added" : "edited",
                    }))}
                  />
                  <span>{field.unit}</span>
                </div>
              </div>
            ))}
          </div>
          {(item.assumptions.length > 0 || item.uncertaintyNotes.length > 0) && (
            <details className="uncertainty-details">
              <summary>Assumptions and uncertainty</summary>
              <ul>{[...item.assumptions, ...item.uncertaintyNotes].map((note) => <li key={note}>{note}</li>)}</ul>
            </details>
          )}
          <div className="food-card-actions">
            <Button variant={item.userState === "confirmed" ? "secondary" : "primary"} size="small" onClick={() => onUpdate((current) => ({ ...current, userState: current.userState === "confirmed" ? "edited" : "confirmed" }))}><Check size={16} /> {item.userState === "confirmed" ? "Confirmed" : "Confirm item"}</Button>
            <Button variant="ghost" size="icon" onClick={onDuplicate} aria-label={`Duplicate ${item.confirmedName}`}><Copy size={17} /></Button>
            <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${item.confirmedName}`}><Trash2 size={17} /></Button>
          </div>
          {(item.aiDetectedName !== item.confirmedName || item.aiEstimatedWeightGrams !== item.confirmedWeightGrams || item.nutrientOverride) && (
            <p className="preservation-note"><Info size={15} /> Original AI and database values remain stored alongside your corrections.</p>
          )}
        </div>
      )}
    </article>
  );
}

function NutritionSearchDialog({
  item,
  open,
  onOpenChange,
  search,
  onChoose,
}: {
  item: EditableMealItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: (query: string) => Promise<NutritionMatch[]>;
  onChoose: (match: NutritionMatch) => void;
}) {
  const [query, setQuery] = useState(item.confirmedName);
  const [results, setResults] = useState<NutritionMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResults(await search(query));
    } catch {
      setError("Nutrition matches could not be loaded. You can keep the current match or enter values manually.");
    } finally {
      setLoading(false);
    }
  }, [query, search]);

  useEffect(() => { void runSearch(); }, [runSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Choose a nutrition match" description="Values are shown per 100 g. Pick the closest preparation, or keep manual values.">
      <form className="search-form" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}>
        <div className="field"><label htmlFor="nutrition-search">Food or preparation</label><div className="search-input"><input id="nutrition-search" value={query} onChange={(event) => setQuery(event.target.value)} /><Button type="submit" size="icon" aria-label="Search"><Search size={18} /></Button></div></div>
      </form>
      {loading && <div className="search-loading"><LoaderCircle className="spin" /> Searching nutrition data...</div>}
      {error && <p className="form-error">{error}</p>}
      <div className="match-results">
        {results.map((match) => (
          <button type="button" key={`${match.source}-${match.sourceRecordId}`} onClick={() => onChoose(match)}>
            <div><strong>{match.description}</strong><span>{match.source === "usda" ? "USDA FoodData Central" : "Demo nutrition data"}{match.uncertain ? " · uncertain" : ""}</span></div>
            <span><strong>{match.nutrientsPer100g.calories}</strong> kcal / 100 g</span>
          </button>
        ))}
      </div>
      {!loading && !error && results.length === 0 && (
        <div className="no-match-note">
          <strong>No close match found</strong>
          <p>Try a broader food name, keep the current match, or enter the label values manually.</p>
        </div>
      )}
      <Button variant="ghost" onClick={() => onOpenChange(false)}><X size={17} /> Keep current match</Button>
    </Dialog>
  );
}
