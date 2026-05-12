import type { Point } from '../types';
import { srcToBlob } from './image';

const API_BASE: string = (import.meta as any).env?.VITE_API_BASE ?? '';

export class EmbeddingLostError extends Error {
  constructor() {
    super('embedding_lost');
    this.name = 'EmbeddingLostError';
  }
}

function url(path: string): string {
  if (!API_BASE) {
    throw new Error(
      'VITE_API_BASE is not set. Add it to .env.local pointing at the cloudflared/ngrok tunnel URL.',
    );
  }
  return `${API_BASE.replace(/\/$/, '')}${path}`;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 409) throw new EmbeddingLostError();
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export interface EncodeResult {
  image_id: string;
  width: number;
  height: number;
}

export async function encodeImage(imageSrc: string): Promise<EncodeResult> {
  const blob = await srcToBlob(imageSrc);
  const form = new FormData();
  form.append('image', blob, 'image.png');
  const res = await fetch(url('/sam/encode'), { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`encode failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function clickMask(
  imageId: string,
  point: Point,
  modifier: 'add' | 'remove' = 'add',
): Promise<string> {
  const data = await postJson<{ mask_png_b64: string }>('/sam/click', {
    image_id: imageId,
    points: [[point.x, point.y]],
    labels: [modifier === 'add' ? 1 : 0],
  });
  return data.mask_png_b64;
}

export async function promptMask(
  imageId: string,
  text: string,
): Promise<{ mask: string; bbox: [number, number, number, number] }> {
  const data = await postJson<{
    mask_png_b64: string;
    bbox: [number, number, number, number];
  }>('/sam/prompt', { image_id: imageId, text });
  return { mask: data.mask_png_b64, bbox: data.bbox };
}

export async function similarMask(
  imageId: string,
  point: Point,
  threshold = 0.7,
): Promise<{ mask: string; count: number }> {
  const data = await postJson<{ mask_png_b64: string; count: number }>(
    '/sam/similar',
    { image_id: imageId, points: [[point.x, point.y]], threshold },
  );
  return { mask: data.mask_png_b64, count: data.count };
}

export async function inpaint(image: Blob, mask: Blob): Promise<string> {
  const form = new FormData();
  form.append('image', image, 'image.png');
  form.append('mask', mask, 'mask.png');
  const res = await fetch(url('/inpaint'), { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`inpaint failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Run `op` and, on 409 embedding_lost, transparently re-encode and retry once.
 */
export async function withEmbeddingRetry<T>(
  imageSrc: string,
  setImageId: (id: string) => void,
  op: () => Promise<T>,
): Promise<T> {
  try {
    return await op();
  } catch (e) {
    if (!(e instanceof EmbeddingLostError)) throw e;
    const enc = await encodeImage(imageSrc);
    setImageId(enc.image_id);
    return op();
  }
}

export function apiBaseConfigured(): boolean {
  return Boolean(API_BASE);
}
