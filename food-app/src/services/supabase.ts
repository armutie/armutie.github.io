import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  mealAnalysisResultSchema,
  savedMealSchema,
  type MealAnalysisInput,
  type MealDraft,
  type Profile,
  type SavedMeal,
} from "@/domain";
import type {
  AppServices,
  AuthService,
  MealRepository,
  MealVisionProvider,
  NutritionProvider,
} from "@/services/interfaces";
import { getAuthRedirectUrl } from "@/lib/auth";
import { ServiceError, type ServiceErrorCode } from "@/services/errors";

type AuthAction = "google" | "email";
type AuthErrorDetails = {
  code?: string;
  status?: number;
};

function createAuthError(error: AuthErrorDetails, action: AuthAction) {
  if (
    error.code === "over_email_send_rate_limit"
    || error.code === "over_request_rate_limit"
    || error.status === 429
  ) {
    const message = action === "email"
      ? "A sign-in email was requested recently. Wait a minute before trying again."
      : "Too many sign-in attempts were made. Wait a few minutes, then try again.";
    return new ServiceError("auth-rate-limit", message, error);
  }

  if (error.code === "provider_disabled" || error.code === "oauth_provider_not_supported") {
    return new ServiceError(
      "unauthorized",
      "Google sign-in is not available right now. Use email instead.",
      error,
    );
  }

  return new ServiceError(
    "unauthorized",
    action === "email"
      ? "The sign-in email could not be sent. Check the address and try again."
      : "Google sign-in could not be started. Try again or use email instead.",
    error,
  );
}

export class SupabaseAuthService implements AuthService {
  constructor(
    private readonly client: SupabaseClient,
    private readonly redirectUrl = getAuthRedirectUrl(),
  ) {}

  async getUser() {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  }

  async signInWithGoogle() {
    const { error } = await this.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: this.redirectUrl },
    });
    if (error) throw createAuthError(error, "google");
  }

  async sendMagicLink(email: string) {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: this.redirectUrl },
    });
    if (error) throw createAuthError(error, "email");
  }

  async signOut() {
    await this.client.auth.signOut();
  }

  onAuthStateChange(listener: Parameters<AuthService["onAuthStateChange"]>[0]) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      listener(user?.email ? { id: user.id, email: user.email } : null);
    });
    return () => data.subscription.unsubscribe();
  }
}

export const SUPABASE_AUTH_OPTIONS = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
} as const;

const VISION_ERROR_DETAILS: Record<string, { code: ServiceErrorCode; message: string }> = {
  timeout: {
    code: "vision-timeout",
    message: "The vision provider took too long. Try again with the same photo.",
  },
  malformed: {
    code: "vision-malformed",
    message: "The provider returned an incomplete result. Run the analysis again.",
  },
  refusal: {
    code: "vision-no-food",
    message: "No meal could be identified in this photo. Try a clearer, well-lit image.",
  },
  unavailable: {
    code: "vision-unavailable",
    message: "The AI service is temporarily unavailable. Try again shortly.",
  },
  "provider-quota": {
    code: "vision-quota",
    message: "The AI service has reached its current quota. Try again later.",
  },
  "provider-configuration": {
    code: "vision-configuration",
    message: "Meal analysis needs a server configuration fix. Try again later.",
  },
  upload: {
    code: "upload",
    message: "The meal photo could not be prepared on the server. Try uploading it again.",
  },
};

export function createVisionServiceError(providerCode: string, cause: unknown) {
  const detail = VISION_ERROR_DETAILS[providerCode] ?? {
    code: "unknown" as const,
    message: "The meal could not be analyzed. Check your connection and try again.",
  };
  return new ServiceError(detail.code, detail.message, cause);
}

class SupabaseVisionProvider implements MealVisionProvider {
  constructor(private readonly client: SupabaseClient) {}

  async analyzeMeal(input: MealAnalysisInput) {
    const { data, error } = await this.client.functions.invoke("analyze-meal", {
      body: {
        imageDataUrl: input.imageDataUrl,
        fileName: input.fileName,
        mimeType: input.mimeType,
        reference: input.reference,
        mealType: input.mealType,
        knownIngredients: input.knownIngredients,
        imageRetention: input.imageRetention,
      },
    });
    if (error) {
      let providerCode = "unknown";
      const context = (error as { context?: Response }).context;
      if (context) {
        try {
          const detail = await context.clone().json() as { code?: string };
          providerCode = detail.code ?? providerCode;
        } catch {
          // Some network and gateway errors do not include a JSON body.
        }
      }
      throw createVisionServiceError(providerCode, error);
    }
    const parsed = mealAnalysisResultSchema.safeParse(data);
    if (!parsed.success) {
      throw new ServiceError(
        "vision-malformed",
        "The analysis response was incomplete. Try the analysis again.",
        parsed.error,
      );
    }
    return parsed.data;
  }
}

class SupabaseNutritionProvider implements NutritionProvider {
  constructor(private readonly client: SupabaseClient) {}

  async searchFoods(query: string) {
    const { data, error } = await this.client.functions.invoke("analyze-meal", {
      body: { action: "nutrition-search", query },
    });
    if (error) throw new ServiceError("nutrition-unavailable", "Nutrition search is unavailable.", error);
    return data.matches;
  }
}

function rowToMeal(row: Record<string, unknown>): SavedMeal {
  const mealItems = (row.meal_items as Array<Record<string, unknown>>).map((item) => ({
    id: item.id,
    temporaryId: item.ai_temporary_id,
    aiDetectedName: item.ai_detected_name,
    confirmedName: item.user_confirmed_name,
    aiEstimatedWeightGrams: item.ai_estimated_weight_grams,
    confirmedWeightGrams: item.user_confirmed_weight_grams,
    minimumWeightGrams: item.minimum_weight_grams,
    maximumWeightGrams: item.maximum_weight_grams,
    confidence: item.confidence,
    nutritionMatch: item.nutrition_match,
    originalNutrients: item.original_nutrients,
    confirmedNutrients: item.confirmed_nutrients,
    assumptions: item.assumptions,
    uncertaintyNotes: item.uncertainty_notes,
    userState: item.user_state,
    nutrientOverride: item.nutrient_override,
  }));
  return savedMealSchema.parse({
    id: row.id,
    clientRequestId: row.client_request_id,
    name: row.name,
    mealType: row.meal_type,
    consumedAt: row.consumed_at,
    notes: row.notes,
    knownIngredients: row.known_ingredients,
    reference: row.reference_object,
    imageRetention: row.image_retention,
    imagePreviewUrl: null,
    imagePath: row.image_path,
    analysis: row.raw_analysis,
    items: mealItems,
    followUpAnswers: row.follow_up_answers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
  });
}

class SupabaseMealRepository implements MealRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async attachSignedImage(meal: SavedMeal) {
    if (!meal.imagePath) return meal;
    const { data, error } = await this.client.storage
      .from("meal-images")
      .createSignedUrl(meal.imagePath, 3600);
    if (error) {
      console.error("Signed meal image URL failed", error.message);
      return meal;
    }
    return { ...meal, imagePreviewUrl: data.signedUrl };
  }

  async listMeals() {
    const { data, error } = await this.client
      .from("meals")
      .select("*, meal_items(*)")
      .order("consumed_at", { ascending: false });
    if (error) throw new ServiceError("storage", "Meals could not be loaded.", error);
    return Promise.all(data.map((row) => this.attachSignedImage(rowToMeal(row))));
  }

  async getMeal(id: string) {
    const { data, error } = await this.client
      .from("meals")
      .select("*, meal_items(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ServiceError("storage", "The meal could not be loaded.", error);
    return data ? this.attachSignedImage(rowToMeal(data)) : null;
  }

  async saveMeal(draft: MealDraft) {
    const user = (await this.client.auth.getUser()).data.user;
    if (!user) throw new ServiceError("unauthorized", "Your session expired. Sign in again.");

    const mealPayload = {
      user_id: user.id,
      client_request_id: draft.clientRequestId,
      name: draft.name,
      meal_type: draft.mealType,
      consumed_at: draft.consumedAt,
      notes: draft.notes,
      known_ingredients: draft.knownIngredients,
      image_path: draft.imagePath,
      image_retention: draft.imageRetention,
      analysis_status: "complete",
      ai_provider: "gemini",
      ai_model: "configured-server-side",
      analysis_schema_version: draft.analysis.analysisVersion,
      overall_confidence: draft.analysis.overallConfidence,
      raw_analysis: draft.analysis,
      reference_object: draft.reference,
      follow_up_answers: draft.followUpAnswers,
    };
    const { data: inserted, error } = await this.client
      .from("meals")
      .upsert(mealPayload, { onConflict: "user_id,client_request_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) throw new ServiceError("storage", "The meal could not be saved.", error);

    let mealId = inserted?.id as string | undefined;
    if (!mealId) {
      const existing = await this.client
        .from("meals")
        .select("id")
        .eq("client_request_id", draft.clientRequestId)
        .single();
      mealId = existing.data?.id;
    }
    if (!mealId) throw new ServiceError("storage", "The saved meal could not be found.");

    const itemPayloads = draft.items.map((item) => ({
      meal_id: mealId,
      ai_temporary_id: item.temporaryId,
      ai_detected_name: item.aiDetectedName,
      user_confirmed_name: item.confirmedName,
      ai_estimated_weight_grams: item.aiEstimatedWeightGrams,
      user_confirmed_weight_grams: item.confirmedWeightGrams,
      minimum_weight_grams: item.minimumWeightGrams,
      maximum_weight_grams: item.maximumWeightGrams,
      confidence: item.confidence,
      nutrition_source: item.nutritionMatch?.source ?? "manual",
      nutrition_source_record_id: item.nutritionMatch?.sourceRecordId,
      nutrition_match: item.nutritionMatch,
      original_nutrients: item.originalNutrients,
      confirmed_nutrients: item.confirmedNutrients,
      user_state: item.userState,
      nutrient_override: item.nutrientOverride,
      assumptions: item.assumptions,
      uncertainty_notes: item.uncertaintyNotes,
    }));
    const { error: itemError } = await this.client
      .from("meal_items")
      .upsert(itemPayloads, { onConflict: "meal_id,ai_temporary_id" });
    if (itemError) throw new ServiceError("storage", "Meal items could not be saved.", itemError);

    const result = await this.getMeal(mealId);
    if (!result) throw new ServiceError("storage", "The saved meal could not be loaded.");
    return result;
  }

  async updateMeal(meal: SavedMeal) {
    const { error: mealError } = await this.client
      .from("meals")
      .update({
        name: meal.name,
        meal_type: meal.mealType,
        consumed_at: meal.consumedAt,
        notes: meal.notes,
        known_ingredients: meal.knownIngredients,
        follow_up_answers: meal.followUpAnswers,
      })
      .eq("id", meal.id);
    if (mealError) throw new ServiceError("storage", "The meal could not be updated.", mealError);

    const itemPayloads = meal.items.map((item) => ({
      id: item.id,
      meal_id: meal.id,
      ai_temporary_id: item.temporaryId,
      ai_detected_name: item.aiDetectedName,
      user_confirmed_name: item.confirmedName,
      ai_estimated_weight_grams: item.aiEstimatedWeightGrams,
      user_confirmed_weight_grams: item.confirmedWeightGrams,
      minimum_weight_grams: item.minimumWeightGrams,
      maximum_weight_grams: item.maximumWeightGrams,
      confidence: item.confidence,
      nutrition_source: item.nutritionMatch?.source ?? "manual",
      nutrition_source_record_id: item.nutritionMatch?.sourceRecordId,
      nutrition_match: item.nutritionMatch,
      original_nutrients: item.originalNutrients,
      confirmed_nutrients: item.confirmedNutrients,
      user_state: item.userState,
      nutrient_override: item.nutrientOverride,
      assumptions: item.assumptions,
      uncertainty_notes: item.uncertaintyNotes,
    }));
    const { error: itemError } = await this.client.from("meal_items").upsert(itemPayloads);
    if (itemError) throw new ServiceError("storage", "Meal items could not be updated.", itemError);

    const keepIds = meal.items.map((item) => item.id);
    let deleteQuery = this.client.from("meal_items").delete().eq("meal_id", meal.id);
    if (keepIds.length) deleteQuery = deleteQuery.not("id", "in", `(${keepIds.join(",")})`);
    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw new ServiceError("storage", "Removed meal items could not be deleted.", deleteError);

    const updated = await this.getMeal(meal.id);
    if (!updated) throw new ServiceError("storage", "The updated meal could not be loaded.");
    return updated;
  }

  async deleteMeal(id: string) {
    const { data: meal } = await this.client.from("meals").select("image_path").eq("id", id).single();
    const { error } = await this.client.from("meals").delete().eq("id", id);
    if (error) throw new ServiceError("storage", "The meal could not be deleted.", error);
    if (meal?.image_path) await this.client.storage.from("meal-images").remove([meal.image_path]);
  }

  async getProfile(): Promise<Profile> {
    const user = (await this.client.auth.getUser()).data.user;
    if (!user) throw new ServiceError("unauthorized", "Sign in to continue.");
    const { data, error } = await this.client.from("profiles").select("*").eq("id", user.id).single();
    if (error) throw new ServiceError("storage", "Your profile could not be loaded.", error);
    return {
      id: data.id,
      displayName: data.display_name || user.email?.split("@")[0] || "Cook",
      timeZone: data.time_zone,
      dailyTargets: data.daily_targets,
    };
  }

  async updateProfile(profile: Profile) {
    const { error } = await this.client
      .from("profiles")
      .update({
        display_name: profile.displayName,
        time_zone: profile.timeZone,
        daily_targets: profile.dailyTargets,
      })
      .eq("id", profile.id);
    if (error) throw new ServiceError("storage", "Your profile could not be updated.", error);
    return profile;
  }
}

export function createSupabaseServices(url: string, anonKey: string): AppServices {
  const client = createClient(url, anonKey, {
    auth: SUPABASE_AUTH_OPTIONS,
  });
  return {
    mode: "production",
    vision: new SupabaseVisionProvider(client),
    nutrition: new SupabaseNutritionProvider(client),
    meals: new SupabaseMealRepository(client),
    auth: new SupabaseAuthService(client),
  };
}
