import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AppContext } from "@/app-context";
import { AppShell } from "@/components/AppShell";
import { AuthScreen } from "@/features/AuthScreen";
import { Dashboard } from "@/features/Dashboard";
import { History } from "@/features/History";
import { MealDetail } from "@/features/MealDetail";
import { SettingsPage } from "@/features/SettingsPage";
import { createServices } from "@/services";
import type { AuthUser } from "@/services/interfaces";
import { Utensils } from "lucide-react";
import { useHashPath } from "@/lib/router";
import { clearOAuthRedirectError, getOAuthRedirectError } from "@/lib/auth";

const serviceResult = createServices();
const AddMealFlow = lazy(() =>
  import("@/features/AddMealFlow").then((module) => ({ default: module.AddMealFlow })),
);

export function App() {
  const services = serviceResult.services;
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [oauthRedirectError] = useState(() => getOAuthRedirectError(window.location.href));
  const path = useHashPath();

  useEffect(() => {
    if (!services) return;
    void services.auth.getUser().then(setUser);
    return services.auth.onAuthStateChange(setUser);
  }, [services]);

  useEffect(() => {
    if (oauthRedirectError) clearOAuthRedirectError();
  }, [oauthRedirectError]);

  const context = useMemo(() => (services && user ? { services, user } : null), [services, user]);

  if (!services) {
    return (
      <main className="configuration-page">
        <div className="empty-state">
          <div className="empty-state-icon"><Utensils /></div>
          <h1>Plateful needs configuration</h1>
          <p>{serviceResult.configurationError}</p>
          <p>For local review, set <code>VITE_DEMO_MODE=true</code> and rebuild.</p>
        </div>
      </main>
    );
  }

  if (user === undefined) return <div className="boot-screen"><div className="brand-loader" /><span>Opening your meal journal...</span></div>;
  if (!user) return <AuthScreen auth={services.auth} initialOAuthError={oauthRedirectError} />;

  let page;
  if (path === "/history") {
    page = <History />;
  } else if (path === "/add") {
    page = (
      <Suspense fallback={<div className="loading-block" style={{ height: 500 }} />}>
        <AddMealFlow />
      </Suspense>
    );
  } else if (path === "/settings") {
    page = <SettingsPage />;
  } else if (path.startsWith("/meal/")) {
    page = <MealDetail id={decodeURIComponent(path.slice("/meal/".length))} />;
  } else {
    page = <Dashboard />;
  }

  return (
    <AppContext.Provider value={context!}>
      <AppShell
        demoMode={services.mode === "demo"}
        email={user.email}
        onSignOut={() => void services.auth.signOut()}
      >
        {page}
      </AppShell>
    </AppContext.Provider>
  );
}
