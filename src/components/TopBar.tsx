"use client";

import type { ReactNode } from "react";
import { useBranding } from "@/lib/branding-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function TopBar({ children }: { children?: ReactNode }) {
  const branding = useBranding();

  return (
    <header className="top-bar">
      {branding?.logoUrl && (
        <img src={branding.logoUrl} alt={branding.nomeAzienda} className="brand-logo" />
      )}
      <div className="top-bar-actions">
        {children}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
