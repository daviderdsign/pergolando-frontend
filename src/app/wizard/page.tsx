"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogDatabase } from "@pergolando/shared/schema";
import type { ConfigurazionePergola } from "@pergolando/shared/pricing-engine";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { TopBar } from "@/components/TopBar";
import {
  PosizionamentoPergola,
  PUNTI_RIFERIMENTO_COUNT,
  type PuntoRiferimento,
  type RettangoloConfermato,
} from "@/components/PosizionamentoPergola";
import { rebasePose, type PosaCamera } from "@/lib/camera-geometry";
import { compositeImages } from "@/lib/image-compose";

/**
 * First wizard step: end-client data + product/sotto-modello/variante
 * selection, base dimensions, colors, comandi, accessori — and now real
 * price calculation (POST /catalog/configura, backed by the same pricing
 * engine used everywhere else). PDF output (VEN-7) is the next slice;
 * there's no "next screen" yet, so this just shows the price breakdown
 * inline rather than advancing anywhere.
 *
 * H1 (altezza per calcolo inclinazione) is collected but never sent to the
 * engine — it has no role in ConfiguraInput, only a real per-listino MINIMUM
 * that isn't in the bundle schema yet (see the dimensions section below).
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
  const [calcolando, setCalcolando] = useState(false);
  const [risultato, setRisultato] = useState<ConfigurazionePergola | null>(null);
  const [calcoloError, setCalcoloError] = useState<string | null>(null);

  const [generandoRendering, setGenerandoRendering] = useState(false);
  const [renderImage, setRenderImage] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Step 1 of the "compose on a real photo" pipeline: just capture/upload the
  // site photo here (kept as a data URL, client-side only — no backend call
  // yet). Steps 2-6 (tapping reference points, OpenCV perspective, 3D
  // compositing, Canny/depth map, ControlNet) build on top of this photo in
  // later slices.
  const [fotoAmbiente, setFotoAmbiente] = useState<string | null>(null);
  const [fotoAmbienteError, setFotoAmbienteError] = useState<string | null>(null);
  // Step 2: the 2-point reference line traced on the photo (normalized
  // coordinates) — tied to the photo itself, reset whenever it's
  // replaced/removed. `lineaLunghezzaCm` is its real length, prefilled with
  // the pergola's own width (the common case: the line traces exactly where
  // the pergola will sit) but editable when the seller traced a different,
  // more precisely measurable reference instead.
  const [puntiRiferimento, setPuntiRiferimento] = useState<PuntoRiferimento[]>([]);
  const [lineaLunghezzaCm, setLineaLunghezzaCm] = useState("");
  // Optional control line (a second, ideally perpendicular reference) —
  // over-determines the camera resection instead of relying on a single
  // line's exact-fit solve, which otherwise absorbs all tap imprecision
  // into the solved yaw (looks like "the perspective is subtly wrong on
  // one side" — real feedback from a live test). See CalcolaProspettivaDto.
  const [puntoControllo, setPuntoControllo] = useState<PuntoRiferimento | null>(null);
  const [lunghezzaControlloCm, setLunghezzaControlloCm] = useState("");

  useEffect(() => {
    if (puntiRiferimento.length === PUNTI_RIFERIMENTO_COUNT && !lineaLunghezzaCm) {
      setLineaLunghezzaCm(larghezza);
    }
  }, [puntiRiferimento.length, lineaLunghezzaCm, larghezza]);

  function handleFotoAmbienteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFotoAmbienteError(t("wizard.fotoAmbienteErrorTipo"));
      return;
    }
    setFotoAmbienteError(null);
    setPuntiRiferimento([]);
    setLineaLunghezzaCm("");
    const reader = new FileReader();
    reader.onload = () => setFotoAmbiente(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleRimuoviFotoAmbiente() {
    setFotoAmbiente(null);
    setFotoAmbienteError(null);
    setPuntiRiferimento([]);
    setLineaLunghezzaCm("");
  }

  // Step 3a: GeoCalib (single-image camera calibration) + a 2-point
  // resection on the backend, from the traced reference line — the result
  // is the roof plane's 4 corners projected back onto the photo (no longer
  // drawn — PosizionamentoPergola switches straight to the grid once this
  // resolves), plus the camera pose relative to that line's own position.
  // Only an intermediate result now: the line is just for calibrating the
  // camera (any convenient, precisely traceable real edge works), not
  // necessarily where the pergola actually goes — step 3b (the grid)
  // handles placement.
  const [calcolandoProspettiva, setCalcolandoProspettiva] = useState(false);
  const [prospettivaError, setProspettivaError] = useState<string | null>(null);
  const [posaCamera, setPosaCamera] = useState<PosaCamera | null>(null);

  // Step 3b: the seller drags freely on a real-unit floor grid (projected
  // from the step 3a camera pose) to choose WHERE the pergola sits — never
  // its size, which always stays the quote's own larghezza/sporgenza (see
  // PosizionamentoPergola). `posaCameraFinale` is the camera pose
  // re-expressed relative to the resulting front-left corner (see
  // rebasePose), which is what step 4 actually renders with; falls back to
  // the raw step 3a pose if the seller never drags (position defaults to
  // being centered on, and flush against, the calibration line itself).
  const [posaCameraFinale, setPosaCameraFinale] = useState<PosaCamera | null>(null);
  const [rettangoloInfo, setRettangoloInfo] = useState<RettangoloConfermato | null>(null);

  function handleConfermaRettangolo(rettangolo: RettangoloConfermato) {
    if (!posaCamera) return;
    setPosaCameraFinale(rebasePose(posaCamera, rettangolo.origineMondo));
    setRettangoloInfo(rettangolo);
    setScena3dImage(null);
    setScena3dError(null);
  }

  // Step 4: render the real 3D model (3d/flag.blend) in that camera pose.
  const [generandoScena3d, setGenerandoScena3d] = useState(false);
  const [scena3dImage, setScena3dImage] = useState<string | null>(null);
  const [scena3dError, setScena3dError] = useState<string | null>(null);

  // Step 6: the final, lifestyle-ready composite — real photo + the
  // already-correctly-positioned grey silhouette (steps 1-4) go to Gemini,
  // a photorealistic image comes back. See RenderFinaleService/
  // buildCompositePrompt on the backend for what's actually asked of it.
  const [generandoFinale, setGenerandoFinale] = useState(false);
  const [immagineFinale, setImmagineFinale] = useState<string | null>(null);
  const [finaleError, setFinaleError] = useState<string | null>(null);

  function handlePuntiRiferimentoChange(updater: (prev: PuntoRiferimento[]) => PuntoRiferimento[]) {
    setPuntiRiferimento(updater);
    // Any change to the points invalidates a previously computed overlay —
    // and the line's real length, which only makes sense for THIS line —
    // and the control line, which starts from punti[0].
    setLineaLunghezzaCm("");
    setPuntoControllo(null);
    setLunghezzaControlloCm("");
    setProspettivaError(null);
    setPosaCamera(null);
    setPosaCameraFinale(null);
    setRettangoloInfo(null);
    setScena3dImage(null);
    setScena3dError(null);
  }

  async function handleCalcolaProspettiva() {
    if (!fotoAmbiente || !lineaLunghezzaCm) return;
    setCalcolandoProspettiva(true);
    setProspettivaError(null);
    setPosaCameraFinale(null);
    setRettangoloInfo(null);
    setScena3dImage(null);
    try {
      const { posaCamera: posa } = await apiFetch<{
        tettoNormalizzato: PuntoRiferimento[];
        posaCamera: PosaCamera;
      }>("/catalog/perspective", {
        method: "POST",
        body: JSON.stringify({
          fotoBase64: fotoAmbiente,
          punti: puntiRiferimento,
          lineaLunghezzaCm: Number(lineaLunghezzaCm),
          ...(puntoControllo && lunghezzaControlloCm
            ? {
                puntoControllo,
                lineaControlloLunghezzaCm: Number(lunghezzaControlloCm),
              }
            : {}),
          lRichiestaCm: Number(larghezza),
          pRichiestaCm: Number(sporgenza),
          altezzaCm: Number(altezza),
        }),
      });
      setPosaCamera(posa);
    } catch (err) {
      setProspettivaError(
        err instanceof ApiError ? err.body.error.message : t("wizard.prospettivaErrorGeneric"),
      );
    } finally {
      setCalcolandoProspettiva(false);
    }
  }

  // deltaH (the rear-side rise, for water drainage) isn't collected by the
  // wizard as its own field yet — altezzaInclinazione's real meaning is
  // still unclear (see the note on the field below), so this is a deliberate
  // placeholder estimate, not a real product value: ~12% of the projection,
  // matching the reference model's own proportions (40cm rise over 300cm).
  const deltaHCmStimato = Math.max(10, Math.round(Number(sporgenza) * 0.12));

  async function handleGeneraScena3d() {
    // The grid-drawn rectangle's pose (step 3b) if the seller placed one;
    // otherwise the raw, un-rebased calibration pose already IS the right
    // default. Both of Blender's assumptions already line up with the
    // calibration frame's own origin without any shift: X=0 is the
    // calibration line's own midpoint (its object points are symmetric
    // around X=0, matching Blender's own center-of-front-edge convention),
    // and the line sits at Z=pCmPreventivo (the assumed wall) — exactly
    // `pCmPreventivo` deeper than Blender's own front-edge origin (Z=0),
    // which is the pergola's own real depth. Rebasing to a non-identity
    // default here (tried twice — once to a corner instead of the center,
    // once to the wall/rear instead of the front) introduced real
    // position/orientation bugs both times; see PosizionamentoPergola's
    // RettangoloConfermato doc.
    const posaDaUsare = posaCameraFinale ?? posaCamera;
    if (!posaDaUsare) return;
    setGenerandoScena3d(true);
    setScena3dError(null);
    try {
      const { imageBase64, mimeType } = await apiFetch<{ imageBase64: string; mimeType: string }>(
        "/catalog/render3d",
        {
          method: "POST",
          body: JSON.stringify({
            lRichiestaCm: Number(larghezza),
            pRichiestaCm: Number(sporgenza),
            altezzaCm: Number(altezza),
            deltaHCm: deltaHCmStimato,
            // The wizard only offers wall/ceiling mounting today (no
            // freestanding option), both of which mean "no rear posts" in
            // the 3D model's terms.
            fissaggio: "parete",
            camera: posaDaUsare,
          }),
        },
      );
      setScena3dImage(`data:${mimeType};base64,${imageBase64}`);
      setImmagineFinale(null);
      setFinaleError(null);
    } catch (err) {
      setScena3dError(
        err instanceof ApiError ? err.body.error.message : t("wizard.scena3dErrorGeneric"),
      );
    } finally {
      setGenerandoScena3d(false);
    }
  }

  async function handleGeneraFinale() {
    if (!fotoAmbiente || !scena3dImage) return;
    setGenerandoFinale(true);
    setFinaleError(null);
    try {
      const fotoConSagoma = await compositeImages(fotoAmbiente, scena3dImage);
      const { imageBase64, mimeType } = await apiFetch<{ imageBase64: string; mimeType: string }>(
        "/catalog/render-finale",
        {
          method: "POST",
          body: JSON.stringify({
            ...buildConfiguraPayload(),
            fotoAmbienteBase64: fotoAmbiente,
            fotoConSagomaBase64: fotoConSagoma,
            deltaHCm: deltaHCmStimato,
          }),
        },
      );
      setImmagineFinale(`data:${mimeType};base64,${imageBase64}`);
    } catch (err) {
      setFinaleError(
        err instanceof ApiError ? err.body.error.message : t("wizard.finaleErrorGeneric"),
      );
    } finally {
      setGenerandoFinale(false);
    }
  }

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
    setRisultato(null);
    setCalcoloError(null);
    setRenderImage(null);
    setRenderError(null);
  }, [sottoModelloKey, varianteKey]);

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.push("/");
  }

  // Shared by /catalog/configura and /catalog/render — a render is always
  // for the exact configuration being priced, same input shape either way.
  function buildConfiguraPayload() {
    const opzioniPrezzoFisso = comandoKey ? [comandoKey] : undefined;
    return {
      sottoModello: sottoModelloKey,
      varianteMontaggio: varianteKey,
      pRichiestaCm: Number(sporgenza),
      lRichiestaCm: Number(larghezza),
      coloreStruttura,
      colorePlastica,
      altezzaMontantiCm: Number(altezza),
      opzioniPrezzoFisso,
      accessoriSelezionati: accessoriSelezionati.length > 0 ? accessoriSelezionati : undefined,
    };
  }

  async function handleCalcola() {
    setCalcolando(true);
    setCalcoloError(null);
    setRisultato(null);
    setRenderImage(null);
    setRenderError(null);
    try {
      const { configurazione } = await apiFetch<{ configurazione: ConfigurazionePergola }>(
        "/catalog/configura",
        { method: "POST", body: JSON.stringify(buildConfiguraPayload()) },
      );
      setRisultato(configurazione);
    } catch (err) {
      setCalcoloError(err instanceof ApiError ? err.body.error.message : t("wizard.calcoloErrorGeneric"));
    } finally {
      setCalcolando(false);
    }
  }

  async function handleGeneraRendering() {
    setGenerandoRendering(true);
    setRenderError(null);
    setRenderImage(null);
    try {
      const { imageBase64, mimeType } = await apiFetch<{ imageBase64: string; mimeType: string }>(
        "/catalog/render",
        { method: "POST", body: JSON.stringify(buildConfiguraPayload()) },
      );
      setRenderImage(`data:${mimeType};base64,${imageBase64}`);
    } catch (err) {
      setRenderError(err instanceof ApiError ? err.body.error.message : t("wizard.renderingErrorGeneric"));
    } finally {
      setGenerandoRendering(false);
    }
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

        <button type="button" disabled={!dimensionsComplete || calcolando} onClick={handleCalcola}>
          {calcolando ? t("wizard.calcolando") : t("wizard.calcola")}
        </button>

        {calcoloError && (
          <p className="error" role="alert">
            {calcoloError}
          </p>
        )}

        {risultato && (
          <section aria-labelledby="risultato-section-heading">
            <h2 id="risultato-section-heading">{t("wizard.risultatoSection")}</h2>
            <ul className="voci-costo-list">
              {risultato.voci_costo.map((v, i) => (
                <li key={i}>
                  <span>{v.descrizione}</span>
                  <span>{v.importo_eur.toFixed(2)} €</span>
                </li>
              ))}
            </ul>
            <p className="prezzo-totale">
              {t("wizard.prezzoTotale")} <strong>{risultato.prezzo_totale_eur.toFixed(2)} €</strong>
            </p>
            {risultato.avvisi.length > 0 && (
              <ul className="avvisi-list">
                {risultato.avvisi.map((a, i) => (
                  <li key={i} className="muted">
                    {a}
                  </li>
                ))}
              </ul>
            )}
            {altezzaInclinazione && (
              <p className="muted">
                H1 ({altezzaInclinazione}cm): {t("wizard.h1NonVerificato")}
              </p>
            )}

            <button type="button" disabled={generandoRendering} onClick={handleGeneraRendering}>
              {generandoRendering ? t("wizard.generandoRendering") : t("wizard.generaRendering")}
            </button>

            {renderError && (
              <p className="error" role="alert">
                {renderError}
              </p>
            )}

            {renderImage && (
              <img src={renderImage} alt={t("wizard.renderingAlt")} className="rendering-image" />
            )}

            <div className="foto-ambiente-section">
              <h3>{t("wizard.fotoAmbienteSection")}</h3>
              <p className="muted">{t("wizard.fotoAmbienteHint")}</p>
              <label htmlFor="fotoAmbiente" className="file-input-label">
                {fotoAmbiente ? t("wizard.fotoAmbienteSostituisci") : t("wizard.fotoAmbienteScegli")}
                <input
                  id="fotoAmbiente"
                  type="file"
                  accept="image/*"
                  onChange={handleFotoAmbienteChange}
                />
              </label>
              {fotoAmbienteError && (
                <p className="error" role="alert">
                  {fotoAmbienteError}
                </p>
              )}
              {fotoAmbiente && (
                <>
                  <button type="button" className="secondary" onClick={handleRimuoviFotoAmbiente}>
                    {t("wizard.fotoAmbienteRimuovi")}
                  </button>

                  <h3>{t("wizard.puntiRiferimentoSection")}</h3>
                  <PosizionamentoPergola
                    fotoSrc={fotoAmbiente}
                    fotoAlt={t("wizard.fotoAmbienteAlt")}
                    punti={puntiRiferimento}
                    onPuntiChange={handlePuntiRiferimentoChange}
                    lunghezzaLineaCm={lineaLunghezzaCm}
                    onLunghezzaLineaCmChange={setLineaLunghezzaCm}
                    posaCamera={posaCamera}
                    lCmPreventivo={Number(larghezza)}
                    pCmPreventivo={Number(sporgenza)}
                    rettangolo={rettangoloInfo}
                    onConfermaRettangolo={handleConfermaRettangolo}
                    puntoControllo={puntoControllo}
                    onPuntoControlloChange={setPuntoControllo}
                    lunghezzaControlloCm={lunghezzaControlloCm}
                    onLunghezzaControlloCmChange={setLunghezzaControlloCm}
                    overlayRender3d={scena3dImage}
                  />

                  {!posaCamera && puntiRiferimento.length === PUNTI_RIFERIMENTO_COUNT && lineaLunghezzaCm && (
                    <button
                      type="button"
                      disabled={calcolandoProspettiva}
                      onClick={handleCalcolaProspettiva}
                    >
                      {calcolandoProspettiva
                        ? t("wizard.calcolandoProspettiva")
                        : t("wizard.calcolaProspettiva")}
                    </button>
                  )}
                  {prospettivaError && (
                    <p className="error" role="alert">
                      {prospettivaError}
                    </p>
                  )}

                  {posaCamera && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={generandoScena3d}
                      onClick={handleGeneraScena3d}
                    >
                      {generandoScena3d
                        ? t("wizard.generandoScena3d")
                        : t("wizard.generaScena3d")}
                    </button>
                  )}
                  {scena3dError && (
                    <p className="error" role="alert">
                      {scena3dError}
                    </p>
                  )}

                  {scena3dImage && (
                    <>
                      <h3>{t("wizard.finaleSection")}</h3>
                      <p className="muted">{t("wizard.finaleHint")}</p>
                      <button
                        type="button"
                        disabled={generandoFinale}
                        onClick={handleGeneraFinale}
                      >
                        {generandoFinale ? t("wizard.generandoFinale") : t("wizard.generaFinale")}
                      </button>
                      {finaleError && (
                        <p className="error" role="alert">
                          {finaleError}
                        </p>
                      )}
                      {immagineFinale && (
                        <img
                          src={immagineFinale}
                          alt={t("wizard.finaleAlt")}
                          className="immagine-finale"
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
