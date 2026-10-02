"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
  cameraModelFromPosa,
  worldToPixel,
  worldToPixelSafe,
  pixelToFloor,
  type PosaCamera,
  type Vec3,
} from "@/lib/camera-geometry";

export interface PuntoRiferimento {
  xNorm: number;
  yNorm: number;
}

/** Exactly 2 points, always in this order (start/end of the reference
 * line) — the seller traces the wall-floor intersection line exactly where
 * the pergola will sit, rather than tapping the pergola's own (not-yet-
 * existing) feet: a real, visible edge is far easier to place precisely
 * than a point floating in empty space. Camera orientation comes from
 * GeoCalib — see PerspectiveService. */
export const PUNTI_RIFERIMENTO_COUNT = 2;

const PUNTO_LABEL_KEYS: TranslationKey[] = [
  "wizard.puntoAnterioreSinistro",
  "wizard.puntoAnterioreDestro",
];

const GRID_STEP_CM = 50;
const GRID_EXTENT_CM = 600;

export interface RettangoloConfermato {
  /** The pergola's CENTER (X) and rear/wall edge (Z) — Blender's own object
   * points are symmetric around X=0 (see 3d/generate_flag.py /
   * roof_object_points), i.e. Blender's origin is the pergola's CENTER, not
   * a corner. Rebasing to a corner instead (an earlier, real bug: shifted
   * the whole render sideways by half the width, unnoticed at first because
   * a pure translation doesn't break left/right symmetry — both pillars
   * still showed, just both shifted) silently misplaced every render. Size
   * is always lCmPreventivo x pCmPreventivo (the priced quote dimensions),
   * never the drawn rectangle's own raw size — see the component docstring.
   * In the calibration line's own world frame — this is what rebasePose
   * expects. */
  origineMondo: Vec3;
}

interface Props {
  fotoSrc: string;
  fotoAlt: string;
  punti: PuntoRiferimento[];
  onPuntiChange: (updater: (prev: PuntoRiferimento[]) => PuntoRiferimento[]) => void;
  lunghezzaLineaCm: string;
  onLunghezzaLineaCmChange: (value: string) => void;
  /** null until "Calcola prospettiva" succeeds — switches the view from
   * line-tracing to the grid, on the SAME image element (no remount: two
   * different photo views swapping in and out reads as a confusing glitch,
   * real feedback from a live test). */
  posaCamera: PosaCamera | null;
  /** The pergola's real, priced width/depth (quote's `larghezza`/
   * `sporgenza`) — the rendered rectangle is always exactly this size;
   * dragging on the grid only chooses WHERE it goes, never resizes it (a
   * drawn rectangle changing the price behind the scenes would be a real
   * problem, not just a UX one). */
  lCmPreventivo: number;
  pCmPreventivo: number;
  rettangolo: RettangoloConfermato | null;
  onConfermaRettangolo: (r: RettangoloConfermato) => void;
  /** Optional control line's far point (paired with punti[0], the corner)
   * and its real length — see CalcolaProspettivaDto for why this helps. */
  puntoControllo: PuntoRiferimento | null;
  onPuntoControlloChange: (p: PuntoRiferimento | null) => void;
  lunghezzaControlloCm: string;
  onLunghezzaControlloCmChange: (value: string) => void;
  /** The real 3D model render (step 4's result), a transparent PNG data URL
   * at the same pixel size as the photo — drawn on top of everything once
   * available. */
  overlayRender3d?: string | null;
}

function isFinitePoint(x: number, y: number) {
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 300 && Math.abs(y) < 300;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

const MAGNIFIER_SIZE_PX = 160; // displayed diameter (CSS px)
const MAGNIFIER_ZOOM = 3;

/**
 * Live loupe shown while a finger/pointer is down on the photo, placing a
 * reference point: the finger itself covers the exact pixel being tapped,
 * so there's otherwise no way to see what's actually under it (real
 * feedback from Davide testing on a phone). Draws a zoomed crop of the
 * source image around the touch point onto a canvas, plus a crosshair
 * (not an X — explicitly corrected) marking the exact point, and sits
 * beside the touch point (left/right, never on top of it, or the finger
 * would cover the loupe too).
 */
function Magnifier({ img, xNorm, yNorm }: { img: HTMLImageElement; xNorm: number; yNorm: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Position in CSS px, relative to the wrap (same box the image fills) —
  // computed from the image's own DISPLAYED size and clamped to stay fully
  // INSIDE it. Anchoring to the wrap's outer edge instead (an earlier
  // version did `left/right: 100%`) put the loupe off-screen whenever the
  // photo fills most of the viewport width, which is the normal case on a
  // phone — found testing in an isolated harness before wiring this in.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img.complete || img.naturalWidth === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cropSizeSrc = MAGNIFIER_SIZE_PX / MAGNIFIER_ZOOM;
    const touchX = xNorm * img.naturalWidth;
    const touchY = yNorm * img.naturalHeight;
    // Clamp the crop to stay inside the source image near the edges — the
    // touch point then isn't exactly centered in the loupe anymore, so the
    // crosshair position below is computed from the clamped crop, not
    // assumed to be dead-center.
    const sx = Math.max(0, Math.min(touchX - cropSizeSrc / 2, Math.max(0, img.naturalWidth - cropSizeSrc)));
    const sy = Math.max(0, Math.min(touchY - cropSizeSrc / 2, Math.max(0, img.naturalHeight - cropSizeSrc)));

    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, MAGNIFIER_SIZE_PX, MAGNIFIER_SIZE_PX);
    ctx.drawImage(img, sx, sy, cropSizeSrc, cropSizeSrc, 0, 0, MAGNIFIER_SIZE_PX, MAGNIFIER_SIZE_PX);

    const crossX = (touchX - sx) * MAGNIFIER_ZOOM;
    const crossY = (touchY - sy) * MAGNIFIER_ZOOM;
    const armLen = 14;
    const drawCross = () => {
      ctx.beginPath();
      ctx.moveTo(crossX - armLen, crossY);
      ctx.lineTo(crossX + armLen, crossY);
      ctx.moveTo(crossX, crossY - armLen);
      ctx.lineTo(crossX, crossY + armLen);
      ctx.stroke();
    };
    ctx.lineCap = "round";
    // white halo first so the red cross stays visible against any image content
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    drawCross();
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 1.5;
    drawCross();
  }, [img, xNorm, yNorm]);

  useEffect(() => {
    const rect = img.getBoundingClientRect();
    const dispW = rect.width;
    const dispH = rect.height;
    if (dispW === 0 || dispH === 0) return;
    const diameter = MAGNIFIER_SIZE_PX;
    const gap = 14;
    const touchX = xNorm * dispW;
    const touchY = yNorm * dispH;
    const maxLeft = Math.max(0, dispW - diameter);
    // Prefer the side opposite the touch point (more room, on average);
    // fall back to the other side if it doesn't actually fit there.
    let left = xNorm > 0.5 ? touchX - diameter - gap : touchX + gap;
    if (left < 0 || left > maxLeft) {
      left = xNorm > 0.5 ? touchX + gap : touchX - diameter - gap;
    }
    left = Math.max(0, Math.min(left, maxLeft));
    const top = Math.max(0, Math.min(touchY - diameter / 2, Math.max(0, dispH - diameter)));
    setPos({ left, top });
  }, [img, xNorm, yNorm]);

  if (!pos) return null;
  return (
    <div className="magnifier" style={{ left: pos.left, top: pos.top }} aria-hidden="true">
      <canvas ref={canvasRef} width={MAGNIFIER_SIZE_PX} height={MAGNIFIER_SIZE_PX} />
    </div>
  );
}

/**
 * Steps 2-3b of the "compose on a real photo" pipeline, as a single
 * continuously-mounted photo view: trace the reference line (2 taps, plus
 * an optional 3rd control point) and give its real length, then — once
 * calibrated — see a real-unit floor grid and drag freely to place the
 * pergola. The two are deliberately independent: the traced line only
 * calibrates the camera (any convenient, precisely traceable real edge
 * works, not necessarily where the pergola goes), and the drag only
 * chooses WHERE the pergola sits — it's always rendered at its true, priced
 * size (lCmPreventivo x pCmPreventivo), never the raw size of whatever
 * rectangle was dragged (a drawn rectangle silently changing the price
 * would be a real problem). See RettangoloConfermato.
 */
export function PosizionamentoPergola({
  fotoSrc,
  fotoAlt,
  punti,
  onPuntiChange,
  lunghezzaLineaCm,
  onLunghezzaLineaCmChange,
  posaCamera,
  lCmPreventivo,
  pCmPreventivo,
  rettangolo,
  onConfermaRettangolo,
  puntoControllo,
  onPuntoControlloChange,
  lunghezzaControlloCm,
  onLunghezzaControlloCmChange,
  overlayRender3d,
}: Props) {
  const { t } = useI18n();
  const imgRef = useRef<HTMLImageElement>(null);
  const [trascinamento, setTrascinamento] = useState<{
    start: { x: number; z: number };
    end: { x: number; z: number };
  } | null>(null);
  const [aggiungendoControllo, setAggiungendoControllo] = useState(false);
  const [magnifier, setMagnifier] = useState<PuntoRiferimento | null>(null);

  const cam = useMemo(() => (posaCamera ? cameraModelFromPosa(posaCamera) : null), [posaCamera]);
  const W = posaCamera?.fotoLarghezzaPx ?? 1;
  const H = posaCamera?.fotoAltezzaPx ?? 1;
  const lineaLunghezza = Number(lunghezzaLineaCm) || 0;

  const grigliaLinee = useMemo(() => {
    if (!cam) return [];
    const linee: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const project = (P: Vec3) => {
      const px = worldToPixelSafe(P, cam);
      if (!px) return null;
      const xNorm = (px[0] / W) * 100;
      const yNorm = (px[1] / H) * 100;
      return isFinitePoint(xNorm, yNorm) ? ([xNorm, yNorm] as [number, number]) : null;
    };
    // Starts exactly at the traced line (world Z=pCmPreventivo, the wall)
    // and extends toward the viewer (decreasing Z) — never past it.
    const zStart = pCmPreventivo;
    const zEnd = pCmPreventivo - GRID_EXTENT_CM;
    const xRange = Math.max(lineaLunghezza, lCmPreventivo, 200);
    for (let x = -xRange; x <= xRange; x += GRID_STEP_CM) {
      const a = project([x, 0, zStart]);
      const b = project([x, 0, zEnd]);
      if (a && b) linee.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
    }
    for (let z = zEnd; z <= zStart; z += GRID_STEP_CM) {
      const a = project([-xRange, 0, z]);
      const b = project([xRange, 0, z]);
      if (a && b) linee.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
    }
    return linee;
  }, [cam, pCmPreventivo, lineaLunghezza, lCmPreventivo, W, H]);

  // While actively dragging: show the RAW rectangle under the finger (most
  // intuitive — it matches finger movement exactly). Once released, show
  // the TRUE-sized (lCmPreventivo x pCmPreventivo) rectangle anchored at
  // the confirmed position instead — the two can visibly differ in size,
  // by design: the drag only ever chooses where the real, priced pergola
  // goes, never how big it is (see RettangoloConfermato).
  const rettangoloPoligono = useMemo(() => {
    if (!cam) return "";
    let corners: Vec3[];
    if (trascinamento) {
      const { start, end } = trascinamento;
      corners = [
        [start.x, 0, start.z],
        [end.x, 0, start.z],
        [end.x, 0, end.z],
        [start.x, 0, end.z],
      ];
    } else {
      // origineMondo is the FRONT edge's center (matches Blender's own
      // object-point origin — see RettangoloConfermato). Default (nothing
      // dragged yet): front flush with the calibration line's own position
      // minus the pergola's depth, i.e. [0,0,0] in this frame by
      // construction (the calibration line sits at Z=pCmPreventivo, the
      // assumed wall, so front = pCmPreventivo - pCmPreventivo = 0) — no
      // rebase actually needed for this default, see handleGeneraScena3d.
      const origine = rettangolo?.origineMondo ?? [0, 0, 0];
      const [centerX, oy, frontZ] = origine;
      const halfL = lCmPreventivo / 2;
      const rearZ = frontZ + pCmPreventivo;
      corners = [
        [centerX - halfL, oy, rearZ],
        [centerX + halfL, oy, rearZ],
        [centerX + halfL, oy, frontZ],
        [centerX - halfL, oy, frontZ],
      ];
    }
    const pts = corners.map((P) => {
      const [u, v] = worldToPixel(P, cam);
      return `${(u / W) * 100},${(v / H) * 100}`;
    });
    return pts.join(" ");
  }, [cam, trascinamento, rettangolo, lCmPreventivo, pCmPreventivo, W, H]);

  // Point-tapping phase (pre-posaCamera): press-move-release instead of a
  // plain click, so the magnifier can follow the finger and the point only
  // commits on release — the user can see exactly where they're about to
  // place it first, instead of committing blind under their own finger.
  function normDaEvento(e: PointerEvent<HTMLImageElement>): PuntoRiferimento | null {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return {
      xNorm: clamp01((e.clientX - rect.left) / rect.width),
      yNorm: clamp01((e.clientY - rect.top) / rect.height),
    };
  }

  function handlePuntoPointerDown(e: PointerEvent<HTMLImageElement>) {
    if (posaCamera) return; // grid phase uses its own drag handlers below
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = normDaEvento(e);
    if (p) setMagnifier(p);
  }

  function handlePuntoPointerMove(e: PointerEvent<HTMLImageElement>) {
    if (posaCamera || !magnifier) return;
    const p = normDaEvento(e);
    if (p) setMagnifier(p);
  }

  function handlePuntoPointerUp() {
    if (posaCamera || !magnifier) return;
    const { xNorm, yNorm } = magnifier;
    setMagnifier(null);
    if (aggiungendoControllo) {
      onPuntoControlloChange({ xNorm, yNorm });
      setAggiungendoControllo(false);
      return;
    }
    onPuntiChange((prev) =>
      prev.length >= PUNTI_RIFERIMENTO_COUNT ? prev : [...prev, { xNorm, yNorm }],
    );
  }

  function pixelDaEvento(e: PointerEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const xNorm = (e.clientX - rect.left) / rect.width;
    const yNorm = (e.clientY - rect.top) / rect.height;
    return { x: xNorm * W, y: yNorm * H };
  }

  function puntoFloorDaEvento(e: PointerEvent<HTMLImageElement>): { x: number; z: number } | null {
    if (!cam) return null;
    const p = pixelDaEvento(e);
    if (!p) return null;
    return pixelToFloor(p.x, p.y, cam);
  }

  function handleGridPointerDown(e: PointerEvent<HTMLImageElement>) {
    if (!posaCamera) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = puntoFloorDaEvento(e);
    if (p) setTrascinamento({ start: p, end: p });
  }

  function handleGridPointerMove(e: PointerEvent<HTMLImageElement>) {
    if (!trascinamento) return;
    e.preventDefault();
    const p = puntoFloorDaEvento(e);
    if (p) setTrascinamento((prev) => (prev ? { ...prev, end: p } : prev));
  }

  function handleGridPointerUp() {
    if (!trascinamento) return;
    const { start, end } = trascinamento;
    setTrascinamento(null);
    if (Math.abs(end.x - start.x) < 5 && Math.abs(end.z - start.z) < 5) return; // treat as a stray tap, not a drag

    // Only POSITION comes from the drag — the rendered pergola is always
    // lCmPreventivo x pCmPreventivo (the quote's priced dimensions), never
    // whatever size was actually dragged (see RettangoloConfermato). The
    // drag's center X becomes the pergola's center; whichever end is
    // closer to the assumed wall depth becomes its rear (wall) edge, so a
    // drag that undershoots or overshoots the wall still anchors sensibly.
    //
    // Blender's own object points put Z=0 at the FRONT (open side) and
    // Z=pCmPreventivo at the rear/wall (see 3d/generate_flag.py) — and its
    // origin (0,0,0) is the center of the FRONT edge, not the rear one. A
    // real bug, caught live: rebasing straight to the rear/wall point put
    // the front pillars AT the wall instead of out at the open edge, with
    // the whole pergola effectively built backwards. The origin has to be
    // the FRONT edge's center, `pCmPreventivo` closer to the camera than
    // the wall point.
    const centerX = (start.x + end.x) / 2;
    const nearZ =
      Math.abs(start.z - pCmPreventivo) < Math.abs(end.z - pCmPreventivo) ? start.z : end.z;
    const frontZ = nearZ - pCmPreventivo;
    onConfermaRettangolo({
      origineMondo: [centerX, 0, frontZ],
    });
  }

  const prossimaEtichetta =
    !posaCamera && punti.length < PUNTI_RIFERIMENTO_COUNT ? t(PUNTO_LABEL_KEYS[punti.length]!) : null;

  return (
    <div className="posizionamento-pergola">
      <p className="muted">
        {posaCamera
          ? t("wizard.grigliaHint")
          : prossimaEtichetta
            ? t("wizard.puntiRiferimentoProssimo").replace("{etichetta}", prossimaEtichetta)
            : t("wizard.puntiRiferimentoPronti")}
      </p>
      <div className="punti-riferimento-image-wrap">
        <img
          ref={imgRef}
          src={fotoSrc}
          alt={fotoAlt}
          className={posaCamera ? "punti-riferimento-image griglia-trascinabile" : "punti-riferimento-image"}
          onPointerDown={(e) => {
            handleGridPointerDown(e);
            handlePuntoPointerDown(e);
          }}
          onPointerMove={(e) => {
            handleGridPointerMove(e);
            handlePuntoPointerMove(e);
          }}
          onPointerUp={() => {
            handleGridPointerUp();
            handlePuntoPointerUp();
          }}
          onPointerCancel={() => setMagnifier(null)}
        />
        {overlayRender3d && (
          <img src={overlayRender3d} alt="" className="render3d-overlay" aria-hidden="true" />
        )}
        {magnifier && imgRef.current && (
          <Magnifier img={imgRef.current} xNorm={magnifier.xNorm} yNorm={magnifier.yNorm} />
        )}
        {posaCamera ? (
          <svg className="griglia-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {grigliaLinee.map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="griglia-linea" />
            ))}
            {rettangoloPoligono && <polygon points={rettangoloPoligono} className="griglia-rettangolo" />}
          </svg>
        ) : (
          <>
            {punti.length === PUNTI_RIFERIMENTO_COUNT && (
              <svg
                className="linea-riferimento-overlay"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line
                  x1={punti[0]!.xNorm * 100}
                  y1={punti[0]!.yNorm * 100}
                  x2={punti[1]!.xNorm * 100}
                  y2={punti[1]!.yNorm * 100}
                  className="linea-riferimento-line"
                />
                {puntoControllo && (
                  <line
                    x1={punti[0]!.xNorm * 100}
                    y1={punti[0]!.yNorm * 100}
                    x2={puntoControllo.xNorm * 100}
                    y2={puntoControllo.yNorm * 100}
                    className="linea-controllo-line"
                  />
                )}
              </svg>
            )}
            {puntoControllo && (
              <button
                type="button"
                className="punto-riferimento-marker punto-controllo-marker"
                style={{ left: `${puntoControllo.xNorm * 100}%`, top: `${puntoControllo.yNorm * 100}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPuntoControlloChange(null);
                }}
                title={t("wizard.puntoControllo")}
              >
                C
              </button>
            )}
            {punti.map((p, i) => (
              <button
                key={i}
                type="button"
                className="punto-riferimento-marker"
                style={{ left: `${p.xNorm * 100}%`, top: `${p.yNorm * 100}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPuntiChange((prev) => prev.filter((_, idx) => idx !== i));
                }}
                title={t(PUNTO_LABEL_KEYS[i]!)}
              >
                {i + 1}
              </button>
            ))}
          </>
        )}
      </div>
      {!posaCamera && (
        <>
          <div className="punti-riferimento-actions">
            <span className="muted">
              {punti.length}/{PUNTI_RIFERIMENTO_COUNT} {t("wizard.puntiRiferimentoContatore")}
            </span>
            {punti.length > 0 && (
              <button type="button" className="secondary" onClick={() => onPuntiChange(() => [])}>
                {t("wizard.puntiRiferimentoReset")}
              </button>
            )}
          </div>
          {punti.length === PUNTI_RIFERIMENTO_COUNT && (
            <div className="lunghezza-linea">
              <label htmlFor="lunghezzaLineaCm">
                {t("wizard.lunghezzaLineaLabel")}
                <input
                  id="lunghezzaLineaCm"
                  type="number"
                  min={1}
                  step="0.5"
                  value={lunghezzaLineaCm}
                  onChange={(e) => onLunghezzaLineaCmChange(e.target.value)}
                />
              </label>
              <p className="muted">{t("wizard.lunghezzaLineaHint")}</p>
            </div>
          )}
          {punti.length === PUNTI_RIFERIMENTO_COUNT &&
            lunghezzaLineaCm &&
            (puntoControllo ? (
              <div className="lunghezza-linea">
                <label htmlFor="lunghezzaControlloCm">
                  {t("wizard.lunghezzaControlloLabel")}
                  <input
                    id="lunghezzaControlloCm"
                    type="number"
                    min={1}
                    step="0.5"
                    value={lunghezzaControlloCm}
                    onChange={(e) => onLunghezzaControlloCmChange(e.target.value)}
                  />
                </label>
                <button type="button" className="secondary" onClick={() => onPuntoControlloChange(null)}>
                  {t("wizard.puntiRiferimentoReset")}
                </button>
              </div>
            ) : (
              <div className="lunghezza-linea">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setAggiungendoControllo(true)}
                >
                  {aggiungendoControllo
                    ? t("wizard.aggiungiControlloAttivo")
                    : t("wizard.aggiungiControllo")}
                </button>
                <p className="muted">{t("wizard.controlloHint")}</p>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
