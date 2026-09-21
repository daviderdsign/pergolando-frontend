"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Branding } from "./branding";

const BrandingContext = createContext<Branding | null>(null);

export function BrandingProvider({
  branding,
  children,
}: {
  branding: Branding | null;
  children: ReactNode;
}) {
  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding(): Branding | null {
  return useContext(BrandingContext);
}
