export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${src.slice(0, 64)}`));
    img.src = src;
  });
}

export async function srcToBlob(src: string): Promise<Blob> {
  if (src.startsWith('data:')) {
    const res = await fetch(src);
    return res.blob();
  }
  const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`failed to fetch image: ${res.status}`);
  return res.blob();
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/png',
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      type,
    );
  });
}
