/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function readHashPath() {
  const value = window.location.hash.replace(/^#/, "");
  return value.startsWith("/") ? value : "/";
}

export function useHashPath() {
  const [path, setPath] = useState(readHashPath);
  useEffect(() => {
    const update = () => setPath(readHashPath());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return path;
}

export function navigate(path: string, replace = false) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (replace) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${normalized}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = normalized;
  }
}

type HashLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string;
  exact?: boolean;
  children: ReactNode;
};

export function HashLink({ to, exact = false, className, children, ...props }: HashLinkProps) {
  const path = useHashPath();
  const active = exact ? path === to : path === to || path.startsWith(`${to}/`);
  return (
    <a
      href={`#${to}`}
      className={cn(className, active && "active")}
      aria-current={active ? "page" : undefined}
      {...props}
    >
      {children}
    </a>
  );
}
