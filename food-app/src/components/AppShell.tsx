import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { BookOpen, Camera, ChevronDown, Home, LogOut, Settings, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { HashLink } from "@/lib/router";

type AppShellProps = {
  demoMode: boolean;
  email: string;
  onSignOut: () => void;
  children: ReactNode;
};

export function AppShell({ demoMode, email, onSignOut, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <HashLink to="/" exact className="brand-link" aria-label="Plateful home">
          <BrandMark />
          <span>Plateful</span>
        </HashLink>
        <div className="topbar-actions">
          {demoMode && <span className="demo-label">Demo mode</span>}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                className="account-trigger"
                aria-label={`Open account menu for ${email}`}
              >
                <UserRound size={19} />
                <span>Account</span>
                <ChevronDown size={15} aria-hidden="true" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="account-menu" align="end" sideOffset={8}>
                <DropdownMenu.Label className="account-menu-identity">
                  <span>Signed in as</span>
                  <strong>{email}</strong>
                </DropdownMenu.Label>
                <DropdownMenu.Separator className="account-menu-separator" />
                <DropdownMenu.Item className="account-menu-action" onSelect={onSignOut}>
                  <LogOut size={17} />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
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
