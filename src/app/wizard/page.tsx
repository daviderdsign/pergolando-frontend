"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogDatabase } from "@pergolando/shared/schema";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { TopBar } from "@/components/TopBar";

/**
 * First wizard step: end-client data + product/sotto-modello/variante
 * selection, plus base dimensions (L, SP, H, H1). Price calculation (VEN-6)
 * and PDF output (VEN-7) are the next slice — "Avanti" here only summarizes
 * the current configuration rather than advancing to a screen that doesn't
 * exist yet.
 *
 * L/SP are range-checked against the selected variante's own constraints
 * (L_max_per_n_moduli, vincoli_dimensionali.P_min_cm/P_max_cm) — those come
 * straight from the bundle, so they're as reliable as the catalog data
 * itself. H1 has a real per-listino MINIMUM (depends on the L/SP combination,
 * for water drainage) that isn't in the bundle schema yet — not enforced
 * here, deliberately not pretended to be checked.
 *
 * Color option values are built to match the pricing engine's own
 * nomeCompleto() (ral prefix when present) byte-for-byte, since
 * validaColori() will check against exactly that string once price
 * calculation is wired in.
 *
 * Fissaggio (wall/ceiling mount) is a plain hardcoded choice, not read from
 * the bundle — the schema only carries a free-text description per variante
 * (variante.fissaggio), not a structured set of options, since this is the
 * first product needing it as a real user choice rather than a fixed trait.
 *
 * Comandi (radio controls) come from sottoModello.opzioni_prezzo_fisso —
 * optional, only defined for products that have it (Flag); the section is
 * hidden entirely when a product doesn't. The selected key maps directly to
 * ConfiguraInput.opzioniPrezzoFisso once price calculation is wired in.
 *
 * Accessori come from sottoModello.accessori — multiple can be selected
 * (unlike comando), and unlike comando their price depends on L/SP so it
 * isn't shown here at all, only once price calculation is wired in and can
 * resolve the right P_riferimento row / L column for each one.
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

  const [larghezza, setLarghezza] = useState("");
  const [sporgenza, setSporgenza] = useState("");
  const [altezza, setAltezza] = useState("");
  const [altezzaInclinazione, setAltezzaInclinazione] = useState("");
  const [summary, setSummary] = useState<string | null>(null);

  const sottoModello = catalog && sottoModelloKey ? catalog.sotto_modelli[sottoModelloKey] : undefined;
  const variante =
    sottoModello && varianteKey ? sottoModello.varianti_montaggio[varianteKey] : undefined;
  const larghezzaMaxCm = variante
    ? Math.max(...Object.values(variante.L_max_per_n_moduli ?? { "1": 0 }))
    : undefined;
  const sporgenzaMinCm = sottoModello?.vincoli_dimensionali.P_min_cm;
  const sporgenzaMaxCm = sottoModello?.vincoli_dimensionali.P_max_cm;

  const dimensionsComplete = Boolean(larghezza && sporgenza && altezza && altezzaInclinazione);

  // Matches the pricing engine's own nomeCompleto() exactly (ral prefix when
  // present) — whatever gets picked here must be byte-for-byte what
  // validaColori() checks against later, or a valid selection would be
  // rejected as an "invalid color" once price calculation is wired in.
  const struttureOptions = useMemo(() => {
    if (!catalog) return [];
    const { standard, con_supplemento } = catalog.prodotto.colori.struttura_e_lame;
    return [
      ...standard.map((c) => ({
        value: c.ral ? `${c.ral} ${c.nome_it}` : c.nome_it,
        label: c.ral ? `${c.ral} ${c.nome_it}` : c.nome_it,
        supplemento: false,
      })),
      ...con_supplemento.map((c) => ({
        value: c.nome_it,
        label: `${c.nome_it} (${t("wizard.coloreSupplemento")})`,
        supplemento: true,
      })),
    ];
  }, [catalog, t]);
  const plasticaOptions = useMemo(
    () => catalog?.prodotto.colori.parti_plastiche.opzioni.map((c) => c.nome_it) ?? [],
    [catalog],
  );
  const [coloreStruttura, setColoreStruttura] = useState("");
  const [colorePlastica, setColorePlastica] = useState("");
  const coloreStrutturaSupplemento = struttureOptions.find(
    (o) => o.value === coloreStruttura,
  )?.supplemento;

  const [fissaggio, setFissaggio] = useState<"parete" | "soffitto">("parete");

  // Only some products define flat-priced add-ons (e.g. Flag's radio
  // controls) — the section itself is hidden when there are none, rather
  // than shown empty.
  const comandoOptions = useMemo(() => {
    if (!sottoModello?.opzioni_prezzo_fisso) return [];
    return Object.entries(sottoModello.opzioni_prezzo_fisso).map(([key, o]) => ({
      key,
      nome: o.nome,
      prezzoEur: o.prezzo_eur,
      vincolo: o.vincolo,
    }));
  }, [sottoModello]);
  const [comandoKey, setComandoKey] = useState("");
  const comando = comandoOptions.find((o) => o.key === comandoKey);

  // Unlike comando (one choice), accessories can be combined freely — the
  // exact price depends on L/SP and is only computed once price calculation
  // is wired in, so this step just collects which ones were requested.
  const accessorioOptions = useMemo(() => {
    if (!sottoModello?.accessori) return [];
    return Object.entries(sottoModello.accessori).map(([key, a]) => ({
      key,
      nome: a.nome,
      indicizzatoPer: a.indicizzato_per,
    }));
  }, [sottoModello]);
  const [accessoriSelezionati, setAccessoriSelezionati] = useState<string[]>([]);
  function toggleAccessorio(key: string) {
    setAccessoriSelezionati((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  useEffect(() => {
    (async () => {
      try {
        await apiFetch("/auth/me");
        const { catalog: loaded } = await apiFetch<{ catalog: CatalogDatabase }>("/catalog");
        setCatalog(loaded);
        const firstKey = Object.keys(loaded.sotto_modelli)[0];
        if (firstKey) setSottoModelloKey(firstKey);
        const firstStandard = loaded.prodotto.colori.struttura_e_lame.standard[0];
        if (firstStandard) {
          setColoreStruttura(
            firstStandard.ral ? `${firstStandard.ral} ${firstStandard.nome_it}` : firstStandard.nome_it,
          );
        }
        const firstPlastica = loaded.prodotto.colori.parti_plastiche.opzioni[0];
        if (firstPlastica) setColorePlastica(firstPlastica.nome_it);
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

  // Each variante has its own L/SP constraints — values entered against a
  // different one wouldn't mean anything, so start the dimensions over.
  useEffect(() => {
    setLarghezza("");
    setSporgenza("");
    setAltezza("");
    setAltezzaInclinazione("");
    setComandoKey("");
    setAccessoriSelezionati([]);
    setSummary(null);
  }, [sottoModelloKey, varianteKey]);

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

        <section aria-labelledby="dimensions-section-heading">
          <h2 id="dimensions-section-heading">{t("wizard.dimensionsSection")}</h2>
          <div className="field-grid">
            <label htmlFor="larghezza">
              {t("wizard.larghezza")}
              <input
                id="larghezza"
                type="number"
                min={1}
                max={larghezzaMaxCm}
                required
                value={larghezza}
                onChange={(e) => setLarghezza(e.target.value)}
              />
            </label>
            <label htmlFor="sporgenza">
              {t("wizard.sporgenza")}
              <input
                id="sporgenza"
                type="number"
                min={sporgenzaMinCm}
                max={sporgenzaMaxCm}
                required
                value={sporgenza}
                onChange={(e) => setSporgenza(e.target.value)}
              />
            </label>
            <label htmlFor="altezza">
              {t("wizard.altezza")}
              <input
                id="altezza"
                type="number"
                min={1}
                required
                value={altezza}
                onChange={(e) => setAltezza(e.target.value)}
              />
            </label>
            <label htmlFor="altezzaInclinazione">
              {t("wizard.altezzaInclinazione")}
              <input
                id="altezzaInclinazione"
                type="number"
                min={1}
                required
                value={altezzaInclinazione}
                onChange={(e) => setAltezzaInclinazione(e.target.value)}
              />
            </label>
          </div>
          {larghezzaMaxCm !== undefined && (
            <p className="muted">
              {t("wizard.larghezzaHint")} {larghezzaMaxCm} cm
            </p>
          )}
          {sporgenzaMinCm !== undefined && sporgenzaMaxCm !== undefined && (
            <p className="muted">
              {t("wizard.sporgenzaHint")} {sporgenzaMinCm}–{sporgenzaMaxCm} cm
            </p>
          )}
        </section>

        <section aria-labelledby="colors-section-heading">
          <h2 id="colors-section-heading">{t("wizard.colorsSection")}</h2>
          <div className="field-grid">
            <label htmlFor="coloreStruttura">
              {t("wizard.coloreStruttura")}
              <select
                id="coloreStruttura"
                value={coloreStruttura}
                onChange={(e) => setColoreStruttura(e.target.value)}
              >
                {struttureOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="colorePlastica">
              {catalog.prodotto.colori.parti_plastiche.tag || t("wizard.colorePlastica")}
              <select
                id="colorePlastica"
                value={colorePlastica}
                onChange={(e) => setColorePlastica(e.target.value)}
              >
                {plasticaOptions.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {coloreStrutturaSupplemento && <p className="muted">{t("wizard.coloreSupplementoHint")}</p>}
        </section>

        <section aria-labelledby="fissaggio-section-heading">
          <h2 id="fissaggio-section-heading">{t("wizard.fissaggioSection")}</h2>
          <div role="radiogroup" aria-labelledby="fissaggio-section-heading" className="field-grid">
            <label htmlFor="fissaggioParete">
              <input
                id="fissaggioParete"
                type="radio"
                name="fissaggio"
                checked={fissaggio === "parete"}
                onChange={() => setFissaggio("parete")}
              />{" "}
              {t("wizard.fissaggioParete")}
            </label>
            <label htmlFor="fissaggioSoffitto">
              <input
                id="fissaggioSoffitto"
                type="radio"
                name="fissaggio"
                checked={fissaggio === "soffitto"}
                onChange={() => setFissaggio("soffitto")}
              />{" "}
              {t("wizard.fissaggioSoffitto")}
            </label>
          </div>
          {variante?.fissaggio && <p className="muted">{variante.fissaggio}</p>}
        </section>

        {comandoOptions.length > 0 && (
          <section aria-labelledby="comando-section-heading">
            <h2 id="comando-section-heading">{t("wizard.comandoSection")}</h2>
            <label htmlFor="comando">
              {t("wizard.comando")}
              <select id="comando" value={comandoKey} onChange={(e) => setComandoKey(e.target.value)}>
                <option value="">{t("wizard.comandoNessuno")}</option>
                {comandoOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.nome} ({o.prezzoEur >= 0 ? "+" : ""}
                    {o.prezzoEur} €)
                  </option>
                ))}
              </select>
            </label>
            {comando?.vincolo && <p className="muted">{comando.vincolo}</p>}
          </section>
        )}

        {accessorioOptions.length > 0 && (
          <section aria-labelledby="accessori-section-heading">
            <h2 id="accessori-section-heading">{t("wizard.accessoriSection")}</h2>
            <p className="muted">{t("wizard.accessoriHint")}</p>
            <ul className="checkbox-list">
              {accessorioOptions.map((a) => (
                <li key={a.key}>
                  <label htmlFor={`accessorio-${a.key}`}>
                    <input
                      id={`accessorio-${a.key}`}
                      type="checkbox"
                      checked={accessoriSelezionati.includes(a.key)}
                      onChange={() => toggleAccessorio(a.key)}
                    />{" "}
                    {a.nome}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button
          type="button"
          disabled={!dimensionsComplete}
          onClick={() =>
            setSummary(
              `${catalog.prodotto.nome} / ${sottoModello?.nome} / ${variante?.nome} — L ${larghezza}cm × SP ${sporgenza}cm, H ${altezza}cm, H1 ${altezzaInclinazione}cm — ${coloreStruttura} / ${colorePlastica} — ${t(fissaggio === "parete" ? "wizard.fissaggioParete" : "wizard.fissaggioSoffitto")}${comando ? ` — ${comando.nome} (${comando.prezzoEur >= 0 ? "+" : ""}${comando.prezzoEur} €)` : ""}${accessoriSelezionati.length > 0 ? ` — ${t("wizard.accessoriSection")}: ${accessoriSelezionati.map((k) => accessorioOptions.find((a) => a.key === k)?.nome).join(", ")}` : ""}`,
            )
          }
        >
          {t("wizard.next")}
        </button>
        {summary && (
          <p className="muted" role="status">
            {summary}
          </p>
        )}
      </main>
    </>
  );
}
