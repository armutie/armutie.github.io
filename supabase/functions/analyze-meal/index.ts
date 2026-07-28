import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import {
  analyzeRequestSchema,
  nutritionSearchRequestSchema,
} from "./schemas.ts";
import {
  createNutritionProvider,
  createVisionProvider,
  ProviderError,
} from "./providers.ts";
import { REFERENCE_OBJECTS } from "./reference-objects.ts";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:4173,https://armutie.github.io")
  .split(",")
  .map((value) => value.trim());

function corsHeaders(origin: string | null) {
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function dataUrlParts(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Invalid image data.");
  return { mimeType: match[1], base64: match[2] };
}

function base64ToBytes(base64: string) {
  const decoded = atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (origin && !allowedOrigins.includes(origin)) return json({ error: "Origin not allowed." }, 403, origin);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required." }, 401, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Supabase function secrets are incomplete.");
    return json({
      error: "Server configuration is incomplete.",
      code: "provider-configuration",
    }, 500, origin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Your session has expired. Sign in again." }, 401, origin);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400, origin);
  }

  const searchRequest = nutritionSearchRequestSchema.safeParse(rawBody);
  if (searchRequest.success) {
    try {
      const matches = await createNutritionProvider().searchFoods(searchRequest.data.query);
      return json({ matches }, 200, origin);
    } catch (error) {
      console.error("Nutrition search error", error instanceof Error ? error.message : error);
      return json({ error: "Nutrition search is temporarily unavailable." }, 502, origin);
    }
  }

  const parsed = analyzeRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: "The analysis request is invalid.", fields: parsed.error.flatten() }, 400, origin);
  }

  const input = parsed.data;
  const image = dataUrlParts(input.imageDataUrl);
  if (image.mimeType !== input.mimeType) return json({ error: "Image type does not match its content." }, 400, origin);
  const bytes = base64ToBytes(image.base64);
  if (bytes.byteLength > 3_000_000) return json({ error: "The prepared image is too large." }, 413, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const imagePath = `${userData.user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await admin.storage
    .from("meal-images")
    .upload(imagePath, bytes, { contentType: image.mimeType, upsert: false });
  if (uploadError) {
    console.error("Image upload failed", uploadError.message);
    return json({
      error: "The photo could not be uploaded. Try again.",
      code: "upload",
    }, 502, origin);
  }

  try {
    const selectedReference = input.reference.type === "custom"
      ? {
          label: input.reference.customLabel || "custom object",
          widthMm: input.reference.customWidthMm ?? null,
          heightMm: null,
          shape: "custom",
        }
      : REFERENCE_OBJECTS[input.reference.type];
    const referenceDescription = selectedReference.widthMm
      ? `${selectedReference.label}, known width or diameter ${selectedReference.widthMm} mm${selectedReference.heightMm ? ` and height ${selectedReference.heightMm} mm` : ""}`
      : "No reference object was selected.";

    const vision = await createVisionProvider().analyzeMeal({
      base64Image: image.base64,
      mimeType: image.mimeType,
      mealType: input.mealType,
      knownIngredients: input.knownIngredients,
      referenceDescription,
    });
    const nutritionProvider = createNutritionProvider();
    const foods = await Promise.all(
      vision.foods.map(async (food) => {
        try {
          const matches = await nutritionProvider.searchFoods(food.name);
          return { ...food, nutritionMatch: matches[0] ?? null };
        } catch (error) {
          console.error("Nutrition enrichment failed", food.temporaryId, error instanceof Error ? error.message : error);
          return { ...food, nutritionMatch: null };
        }
      }),
    );

    if (input.imageRetention === "delete_after_analysis") {
      const { error: deleteError } = await admin.storage.from("meal-images").remove([imagePath]);
      if (deleteError) {
        console.error("Temporary image deletion failed", deleteError.message);
        return json({
          error: "Analysis completed, but the temporary photo could not be deleted. Please retry.",
          code: "upload",
        }, 502, origin);
      }
    }

    return json({
      ...vision,
      foods,
      imagePath: input.imageRetention === "retain" ? imagePath : null,
    }, 200, origin);
  } catch (error) {
    const providerError = error instanceof ProviderError ? error : null;
    console.error("Meal analysis error", error instanceof Error ? error.message : error);
    await admin.storage.from("meal-images").remove([imagePath]);
    return json({
      error: providerError?.message ?? "Meal analysis is temporarily unavailable.",
      code: providerError?.code ?? "unknown",
    }, providerError?.status ?? 502, origin);
  }
});
