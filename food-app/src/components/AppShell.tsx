import { BookOpen, Camera, Home, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { HashLink } from "@/lib/router";

type AppShellProps = {
  demoMode: boolean;
  onSignOut: () => void;
  children: ReactNode;
};

export function AppShell({ demoMode, onSignOut, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <HashLink to="/" exact className="brand-link" aria-label="Plateful home">
          <BrandMark />
          <span>Plateful</span>
        </HashLink>
        <div className="topbar-actions">
          {demoMode && <span className="demo-label">Demo mode</span>}
          <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sign out">
            <LogOut size={19} />
          </Button>
        </div>
      </header>

      <main className="page-container">
        {children}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <HashLink to="/" exact>
          <Home size={21} />
          <span>Today</span>
        </HashLink>
        <HashLink to="/history">
          <BookOpen size={21} />
          <span>History</span>
        </HashLink>
        <HashLink to="/add" className="add-nav">
          <span className="add-nav-icon">
            <Camera size={23} />
          </span>
          <span>Add meal</span>
        </HashLink>
        <HashLink to="/settings">
          <Settings size={21} />
          <span>Targets</span>
        </HashLink>
      </nav>
    </div>
  );
}
