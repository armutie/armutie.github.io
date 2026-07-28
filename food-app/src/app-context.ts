import { createContext, useContext } from "react";
import type { AppServices, AuthUser } from "@/services/interfaces";

type AppContextValue = {
  services: AppServices;
  user: AuthUser;
};

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppContext.");
  return context;
}
