"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogDatabase } from "@pergolando/shared/schema";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { TopBar } from "@/components/TopBar";

/**
 * First wizard step: end-client data + product/sotto-modello/variante
 * selection from the tenant's bundle. Dimensions (VEN-4), price calculation
 * (VEN-6) and PDF output (VEN-7) are the next slice — "Avanti" here only
 * summarizes the current selection rather than advancing to a screen that
 * doesn't exist yet.
 */
export default function WizardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogDatabase | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");

  const sottoModelloKeys = useMemo(
    () => (catalog ? Object.keys(catalog.sotto_modelli) : []),
    [catalog],
  );
  const [sottoModelloKey, setSottoModelloKey] = useState("");
  const varianteKeys = useMemo(() => {
    if (!catalog || !sottoModelloKey) return [];
    return Object.keys(catalog.sotto_modelli[sottoModelloKey]!.varianti_montaggio);
  }, [catalog, sottoModelloKey]);
  const [varianteKey, setVarianteKey] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await apiFetch("/auth/me");
        const { catalog: loaded } = await apiFetch<{ catalog: CatalogDatabase }>("/catalog");
        setCatalog(loaded);
        const firstKey = Object.keys(loaded.sotto_modelli)[0];
        if (firstKey) setSottoModelloKey(firstKey);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/");
          return;
        }
        throw err;
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!catalog || !sottoModelloKey) return;
    const firstVariante = Object.keys(catalog.sotto_modelli[sottoModelloKey]!.varianti_montaggio)[0];
    setVarianteKey(firstVariante ?? "");
  }, [catalog, sottoModelloKey]);

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <main className="page">
        <p>{t("wizard.loadingCatalog")}</p>
      </main>
    );
  }

  if (!catalog) return null;

  return (
    <>
      <TopBar>
        <button type="button" onClick={handleLogout}>
          {t("nav.logout")}
        </button>
      </TopBar>
      <main className="page wizard-page">
        <h1>{t("wizard.title")}</h1>

        <section aria-labelledby="client-section-heading">
          <h2 id="client-section-heading">{t("wizard.clientSection")}</h2>
          <div className="field-grid">
            <label htmlFor="firstName">
              {t("wizard.clientFirstName")}
              <input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label htmlFor="lastName">
              {t("wizard.clientLastName")}
              <input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
          </div>
          <label htmlFor="address">
            {t("wizard.clientAddress")}
            <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
        </section>

        <section aria-labelledby="product-section-heading">
          <h2 id="product-section-heading">{t("wizard.productSection")}</h2>
          <p className="muted">{catalog.prodotto.nome}</p>
          <div className="field-grid">
            <label htmlFor="sottoModello">
              {t("wizard.sottoModello")}
              <select
                id="sottoModello"
                value={sottoModelloKey}
                onChange={(e) => setSottoModelloKey(e.target.value)}
              >
                {sottoModelloKeys.map((key) => (
                  <option key={key} value={key}>
                    {catalog.sotto_modelli[key]!.nome}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="variante">
              {t("wizard.variante")}
              <select
                id="variante"
                value={varianteKey}
                onChange={(e) => setVarianteKey(e.target.value)}
                disabled={varianteKeys.length === 0}
              >
                {varianteKeys.map((key) => (
                  <option key={key} value={key}>
                    {catalog.sotto_modelli[sottoModelloKey]!.varianti_montaggio[key]!.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <button type="button" disabled>
          {t("wizard.next")}
        </button>
      </main>
    </>
  );
}
