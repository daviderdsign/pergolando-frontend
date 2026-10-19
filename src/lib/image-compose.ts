// A real phone photo (e.g. 4096x3072) composited at full resolution and
// encoded as PNG came out ~27MB as a data URL — on its own already almost
// double the backend's 15mb JSON body limit (src/main.ts), before even
// adding fotoAmbienteBase64 alongside it in the render-finale payload.
// Found 2026-10-03 reproducing a live "si è verificato un errore" failure
// that left no trace in the backend's own logs at all — the oversized body
// never made it past the body-parser to anywhere that would log it. Same
// fix as pergolando-geocalib-service's own resolution crash: Gemini doesn't
// need full camera resolution to understand where/how big the silhouette
// is, so cap it before encoding, same as the geocalib fix's max dimension.
const MAX_DIMENSION_PX = 1600;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}

function scaledSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Re-encodes a (possibly huge) photo data URL at a capped resolution —
 * used both standalone (fotoAmbienteBase64) and as the base for
 * compositeImages below, so every image in the render-finale payload goes
 * through the same size cap. JPEG, not PNG: this is always a flattened
 * photo with no transparency to preserve. */
export async function downscaleDataUrl(src: string, quality = 0.9): Promise<string> {
  const img = await loadImage(src);
  const { width, height } = scaledSize(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-2d-unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Flattens the transparent step-4 render on top of the site photo into a
 * single JPEG data URL, client-side (canvas) — needed for step 6
 * (POST catalog/render-finale): Gemini needs actual pixel data showing
 * exactly where/how big the silhouette is, not two separately-layered DOM
 * images. Capped to MAX_DIMENSION_PX, see above.
 */
export async function compositeImages(fotoSrc: string, overlaySrc: string, shadowSrc?: string): Promise<string> {
  const [foto, overlay] = await Promise.all([loadImage(fotoSrc), loadImage(overlaySrc)]);
  const { width, height } = scaledSize(foto.naturalWidth, foto.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-2d-unavailable");
  ctx.drawImage(foto, 0, 0, width, height);
  if (shadowSrc) ctx.drawImage(await loadImage(shadowSrc), 0, 0, width, height);
  ctx.drawImage(overlay, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** Same canvas dimensions as the composed photo; alpha is the product silhouette. */
export async function pergolaMask(photo:string,overlay:string):Promise<string>{
 const [background,product]=await Promise.all([loadImage(photo),loadImage(overlay)]);
 const {width,height}=scaledSize(background.naturalWidth,background.naturalHeight);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Maschera non disponibile.');
 ctx.drawImage(product,0,0,width,height);const pixels=ctx.getImageData(0,0,width,height);
 let visible=0;for(let i=0;i<pixels.data.length;i+=4){const value=pixels.data[i+3]>127?255:0;visible+=value?1:0;pixels.data[i]=value;pixels.data[i+1]=value;pixels.data[i+2]=value;pixels.data[i+3]=255;}
 if(!visible||visible>width*height*.95)throw new Error('Il rendering non contiene una trasparenza valida per la maschera.');
 ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
}
