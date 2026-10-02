/**
 * Flattens the transparent step-4 render on top of the site photo into a
 * single PNG data URL, client-side (canvas) — needed for step 6
 * (POST catalog/render-finale): Gemini needs actual pixel data showing
 * exactly where/how big the silhouette is, not two separately-layered DOM
 * images.
 */
export function compositeImages(fotoSrc: string, overlaySrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const foto = new Image();
    foto.onload = () => {
      const overlay = new Image();
      overlay.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = foto.naturalWidth;
        canvas.height = foto.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas-2d-unavailable"));
          return;
        }
        ctx.drawImage(foto, 0, 0, canvas.width, canvas.height);
        ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      overlay.onerror = () => reject(new Error("overlay-load-failed"));
      overlay.src = overlaySrc;
    };
    foto.onerror = () => reject(new Error("foto-load-failed"));
    foto.src = fotoSrc;
  });
}
