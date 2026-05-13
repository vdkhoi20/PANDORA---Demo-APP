import { loadImage } from './image';

export function createMaskCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  return c;
}

export function clearMask(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function stampBrush(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  erase: boolean,
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = erase ? '#000' : '#fff';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function strokeBrush(
  canvas: HTMLCanvasElement,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  erase: boolean,
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = erase ? '#000' : '#fff';
  ctx.lineWidth = radius * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** OR-merge a server-returned binary PNG mask onto the mask canvas. */
export async function mergeMaskFromDataUrl(
  canvas: HTMLCanvasElement,
  dataUrl: string,
): Promise<void> {
  const img = await loadImage(dataUrl);
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const tctx = tmp.getContext('2d')!;
  tctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const tImg = tctx.getImageData(0, 0, canvas.width, canvas.height);

  const ctx = canvas.getContext('2d')!;
  const cur = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const a = cur.data;
  const b = tImg.data;
  for (let i = 0; i < a.length; i += 4) {
    if (b[i] > 127) {
      a[i] = 255;
      a[i + 1] = 255;
      a[i + 2] = 255;
      a[i + 3] = 255;
    }
  }
  ctx.putImageData(cur, 0, 0);
}

/** Render the mask canvas as a translucent red overlay on `out`. */
export function renderOverlay(
  mask: HTMLCanvasElement,
  out: HTMLCanvasElement,
): void {
  out.width = mask.width;
  out.height = mask.height;
  const ctx = out.getContext('2d')!;
  ctx.clearRect(0, 0, out.width, out.height);
  const src = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height);
  const dst = ctx.createImageData(mask.width, mask.height);
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i] > 127) {
      dst.data[i] = 244;
      dst.data[i + 1] = 63;
      dst.data[i + 2] = 94;
      dst.data[i + 3] = 110;
    }
  }
  ctx.putImageData(dst, 0, 0);
}

export function isMaskEmpty(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 127) return false;
  }
  return true;
}

export async function maskToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d')!;
  const src = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const dst = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < src.data.length; i += 4) {
    const on = src.data[i] > 127;
    const v = on ? 255 : 0;
    dst.data[i] = v;
    dst.data[i + 1] = v;
    dst.data[i + 2] = v;
    dst.data[i + 3] = 255;
  }
  ctx.putImageData(dst, 0, 0);
  return new Promise((resolve, reject) =>
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('mask toBlob returned null'))),
      'image/png',
    ),
  );
}

export function snapshotMask(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

export async function restoreMask(
  canvas: HTMLCanvasElement,
  dataUrl: string,
): Promise<void> {
  const img = await loadImage(dataUrl);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}
