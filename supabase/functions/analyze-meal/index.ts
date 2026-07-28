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
    "Access-Control-Expose-Headers": "X-Request-ID",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null, requestId: string) {
  const responseBody = body && typeof body === "object" && !Array.isArray(body)
    ? { ...body, requestId }
    : body;
  return new Response(JSON.stringify(responseBody), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
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
  const requestId = crypto.randomUUID();
  const origin = request.headers.get("Origin");
  const respond = (body: unknown, status: number) => json(body, status, origin, requestId);
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders(origin), "X-Request-ID": requestId },
    });
  }
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);
  if (origin && !allowedOrigins.includes(origin)) return respond({ error: "Origin not allowed." }, 403);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return respond({ error: "Authentication required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Supabase function secrets are incomplete.");
    return respond({
      error: "Server configuration is incomplete.",
      code: "provider-configuration",
    }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return respond({ error: "Your session has expired. Sign in again." }, 401);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return respond({ error: "Request body must be valid JSON." }, 400);
  }

  const searchRequest = nutritionSearchRequestSchema.safeParse(rawBody);
  if (searchRequest.success) {
    try {
      const matches = await createNutritionProvider().searchFoods(searchRequest.data.query);
      return respond({ matches }, 200);
    } catch (error) {
      console.error("Nutrition search error", error instanceof Error ? error.message : error);
      return respond({ error: "Nutrition search is temporarily unavailable." }, 502);
    }
  }

  const parsed = analyzeRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return respond({ error: "The analysis request is invalid.", fields: parsed.error.flatten() }, 400);
  }

  const input = parsed.data;
  const image = dataUrlParts(input.imageDataUrl);
  if (image.mimeType !== input.mimeType) return respond({ error: "Image type does not match its content." }, 400);
  const bytes = base64ToBytes(image.base64);
  if (bytes.byteLength > 3_000_000) return respond({ error: "The prepared image is too large." }, 413);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const imagePath = `${userData.user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await admin.storage
    .from("meal-images")
    .upload(imagePath, bytes, { contentType: image.mimeType, upsert: false });
  if (uploadError) {
    console.error("Image upload failed", uploadError.message);
    return respond({
      error: "The photo could not be uploaded. Try again.",
      code: "upload",
    }, 502);
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
      requestId,
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
        return respond({
          error: "Analysis completed, but the temporary photo could not be deleted. Please retry.",
          code: "upload",
        }, 502);
      }
    }

    return respond({
      ...vision,
      foods,
      imagePath: input.imageRetention === "retain" ? imagePath : null,
    }, 200);
  } catch (error) {
    const providerError = error instanceof ProviderError ? error : null;
    console.error("Meal analysis error", error instanceof Error ? error.message : error);
    await admin.storage.from("meal-images").remove([imagePath]);
    return respond({
      error: providerError?.message ?? "Meal analysis is temporarily unavailable.",
      code: providerError?.code ?? "unknown",
    }, providerError?.status ?? 502);
  }
});
