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
 * Fetched once, server-side, in the root layout — /branding needs no
 * session (the login page itself must be able to show it) and rarely
 * changes, so there's no reason to re-fetch it per page.
 */
export async function fetchBranding(): Promise<Branding | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/branding`, {
      // Branding changes only when the tenant re-deploys with a new bundle —
      // safe to let the platform cache this for the lifetime of the server.
      cache: "force-cache",
    });
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
