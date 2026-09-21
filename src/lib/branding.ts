const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface Branding {
  nomeAzienda: string;
  logoUrl: string | null;
  palette: {
    primario: string;
    secondario?: string;
    testo?: string;
    sfondo?: string;
  };
}

/**
 * Fetched server-side, in the root layout, on every request — /branding
 * needs no session (the login page itself must be able to show it).
 *
 * Deliberately NOT cached: the backend's bundle can be swapped on disk and
 * reloaded (container restart) independently of the frontend, and Next's
 * fetch cache has no automatic invalidation for that — a cached response
 * would keep serving the previous tenant's branding indefinitely until the
 * frontend itself happens to redeploy. The payload is tiny, so paying a
 * fetch per request is the safer default over silent staleness.
 */
export async function fetchBranding(): Promise<Branding | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/branding`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      branding: {
        theme: {
          nome_azienda: string;
          logo_path?: string;
          palette: Branding["palette"];
        };
      };
    };
    const theme = data.branding.theme;
    return {
      nomeAzienda: theme.nome_azienda,
      logoUrl: theme.logo_path ? `${API_BASE_URL}/api/v1/branding/logo` : null,
      palette: theme.palette,
    };
  } catch {
    // Backend unreachable at build/boot time — the app still renders with
    // the default palette rather than failing entirely.
    return null;
  }
}

/** Only accepts values that are safe to interpolate into a <style> tag. */
const SAFE_CSS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgb\([^)]*\)|rgba\([^)]*\)|[a-zA-Z]+)$/;

export function safeColor(value: string | undefined, fallback: string): string {
  if (value && SAFE_CSS_COLOR.test(value.trim())) return value.trim();
  return fallback;
}
