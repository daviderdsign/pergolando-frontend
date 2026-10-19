import {Suspense} from 'react';
import {CaseRoad} from '@/components/CaseRoad';
import {SetupGate} from '@/components/SetupGate';
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { BrandingProvider } from "@/lib/branding-context";
import { fetchBranding, safeColor } from "@/lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pergolando",
  description: "App Venditore",
  applicationName: "Pergolando",
  appleWebApp: { capable: true, title: "Pergolando", statusBarStyle: "default" },
  icons: { apple: [{url:"/icons/pergolando-180.png",sizes:"180x180",type:"image/png"}], icon: [{url:"/icons/pergolando-192.png",sizes:"192x192",type:"image/png"}] },
};

// Branding is fetched from the backend at request time, not build time — the
// backend isn't reachable during `next build` (separate Docker build stage),
// so without this every page gets prerendered once as static HTML with no
// branding baked in, permanently, regardless of what the backend serves
// later. Same class of bug as Studio's home page (see its CHANGELOG entry).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const branding = await fetchBranding();
  const primario = safeColor(branding?.palette.primario, "#111827");
  const secondario = safeColor(branding?.palette.secondario, primario);
  const testo = safeColor(branding?.palette.testo, "#111827");
  const sfondo = safeColor(branding?.palette.sfondo, "#ffffff");

  return (
    <html lang="it">
      <head>
        <style>{`:root{--color-primary:${primario};--color-secondary:${secondario};--color-text:${testo};--color-background:${sfondo};}`}</style>
      </head>
      <body>
        <BrandingProvider branding={branding}>
          <I18nProvider><SetupGate>{children}<Suspense fallback={null}><CaseRoad/></Suspense></SetupGate></I18nProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
