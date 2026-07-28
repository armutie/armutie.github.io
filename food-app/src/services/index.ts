import { readEnvironment } from "@/lib/env";
import type { AppServices } from "@/services/interfaces";
import { createMockServices } from "@/services/mock";
import { createSupabaseServices } from "@/services/supabase";

const environment = readEnvironment();

export function createServices(): { services: AppServices | null; configurationError?: string } {
  if (environment.demoMode) return { services: createMockServices() };
  if (environment.supabaseUrl && environment.supabaseAnonKey) {
    return { services: createSupabaseServices(environment.supabaseUrl, environment.supabaseAnonKey) };
  }
  return {
    services: null,
    configurationError:
      environment.configurationError ??
      "This deployment is not configured. Set Supabase variables or explicitly enable demo mode.",
  };
}
