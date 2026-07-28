import type {
  MealAnalysisInput,
  MealAnalysisResult,
  NutritionMatch,
  Profile,
  SavedMeal,
  MealDraft,
} from "@/domain";

export interface MealVisionProvider {
  analyzeMeal(input: MealAnalysisInput): Promise<MealAnalysisResult>;
}

export interface NutritionProvider {
  searchFoods(query: string): Promise<NutritionMatch[]>;
}

export interface MealRepository {
  listMeals(): Promise<SavedMeal[]>;
  getMeal(id: string): Promise<SavedMeal | null>;
  saveMeal(draft: MealDraft): Promise<SavedMeal>;
  updateMeal(meal: SavedMeal): Promise<SavedMeal>;
  deleteMeal(id: string): Promise<void>;
  getProfile(): Promise<Profile>;
  updateProfile(profile: Profile): Promise<Profile>;
}

export type AuthUser = {
  id: string;
  email: string;
};

export interface AuthService {
  getUser(): Promise<AuthUser | null>;
  signInWithGoogle(): Promise<void>;
  sendMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChange(listener: (user: AuthUser | null) => void): () => void;
}

export type AppServices = {
  mode: "demo" | "production";
  vision: MealVisionProvider;
  nutrition: NutritionProvider;
  meals: MealRepository;
  auth: AuthService;
};
