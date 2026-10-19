/**
 * Resolved lazily (not a module-level const) for two reasons: `window` isn't
 * defined during SSR, and — the actual point of this, 2026-10-05 — Davide
 * needs the same dev build reachable from whatever network he's on right
 * now (office LAN during the day, Tailscale from outside, localhost when
 * testing on this machine directly) without hardcoding one IP. Falls back
 * to whatever host the PAGE itself was loaded from (same machine, same
 * Tailscale/LAN address, just port 3001 instead of 3000) — set
 * NEXT_PUBLIC_API_URL explicitly only to override this.
 */
function resolveApiBaseUrl(): string {
  if(typeof window!=="undefined" && window.location.hostname==="pergolando.rdsign-app.it") return window.location.origin;
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:3001`;
  return "http://localhost:3001";
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: { field: string; message: string }[];
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.error?.message?.trim() || `Il servizio ha restituito un errore HTTP ${status}. Riprova o verifica i servizi sul server.`);
  }
}

/**
 * The backend's session cookie is httpOnly and scoped to its own origin, so
 * every call needs `credentials: "include"` (and the backend's CORS_ORIGIN
 * must list this frontend's origin) — there is no token to attach manually.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${resolveApiBaseUrl()}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({
      error: { code: "UNKNOWN", message: res.statusText },
    }))) as ApiErrorBody;
    if(body.error?.code==='SETUP_REQUIRED'&&typeof window!=='undefined'&&window.location.pathname!=='/impostazioni')window.location.assign('/impostazioni');
    throw new ApiError(res.status, body);
  }

  if(typeof window!=='undefined'&&path.startsWith('/cases')&&init?.method&&init.method!=='GET')window.dispatchEvent(new Event('pergolando:case-changed'));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiDownload(path:string,name:string){
 const response=await fetch(`${resolveApiBaseUrl()}/api/v1${path}`,{credentials:'include'});
 if(!response.ok)throw new Error('Documento non disponibile o sessione scaduta.');
 const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
