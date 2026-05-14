import { useCallback } from 'react';
import {
  EmbeddingLostError,
  clickMask,
  encodeImage,
  inpaint,
  promptMask,
  similarMask,
  withEmbeddingRetry,
} from '../lib/api';
import { maskToBlob, mergeMaskFromDataUrl } from '../lib/mask';
import { srcToBlob } from '../lib/image';
import { useEditor } from '../state/useEditor';
import {
  Sparkles,
  MousePointer2,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { createElement } from 'react';
import type { Point } from '../types';

export function useMaskActions() {
  const ed = useEditor();

  const ensureEncoded = useCallback(async (): Promise<string> => {
    if (!ed.image) throw new Error('no_image');
    if (ed.imageId) return ed.imageId;
    ed.startProcessing('encode');
    try {
      const { image_id } = await encodeImage(ed.image);
      ed.setImageId(image_id);
      return image_id;
    } finally {
      ed.endProcessing();
    }
  }, [ed]);

  const click = useCallback(
    async (point: Point) => {
      if (!ed.image) return;
      ed.setErrorBanner(null);
      ed.startProcessing('click-mask');
      try {
        const id = await ensureEncoded();
        await ed.snapshotMaskState();
        const dataUrl = await withEmbeddingRetry(ed.image, ed.setImageId, () =>
          clickMask(id, point, 'add'),
        );
        const canvas = ed.getMaskCanvas();
        if (canvas) {
          await mergeMaskFromDataUrl(canvas, dataUrl);
          ed.bumpMaskVersion();
        }
        ed.pushHistory({
          type: 'Click mask added',
          icon: createElement(MousePointer2, { size: 14 }),
          color: 'text-violet-400',
        });
      } catch (e) {
        const msg = e instanceof EmbeddingLostError ? 'session expired' : (e as Error).message;
        ed.setErrorBanner(`Click mask failed: ${msg}`);
      } finally {
        ed.endProcessing();
      }
    },
    [ed, ensureEncoded],
  );

  const prompt = useCallback(
    async (text: string) => {
      if (!ed.image || !text.trim()) return;
      ed.setErrorBanner(null);
      ed.startProcessing('prompt');
      try {
        const id = await ensureEncoded();
        await ed.snapshotMaskState();
        const { mask } = await withEmbeddingRetry(ed.image, ed.setImageId, () =>
          promptMask(id, text.trim()),
        );
        const canvas = ed.getMaskCanvas();
        if (canvas) {
          await mergeMaskFromDataUrl(canvas, mask);
          ed.bumpMaskVersion();
        }
        ed.pushHistory({
          type: `Selected via prompt: "${text.trim().slice(0, 24)}"`,
          icon: createElement(Sparkles, { size: 14 }),
          color: 'text-violet-400',
        });
      } catch (e) {
        ed.setErrorBanner(`Prompt mask failed: ${(e as Error).message}`);
      } finally {
        ed.endProcessing();
      }
    },
    [ed, ensureEncoded],
  );

  const similar = useCallback(
    async (point: Point) => {
      if (!ed.image) return;
      ed.setErrorBanner(null);
      ed.startProcessing('similar');
      try {
        const id = await ensureEncoded();
        await ed.snapshotMaskState();
        const { mask, count } = await withEmbeddingRetry(
          ed.image,
          ed.setImageId,
          () => similarMask(id, point),
        );
        const canvas = ed.getMaskCanvas();
        if (canvas) {
          await mergeMaskFromDataUrl(canvas, mask);
          ed.bumpMaskVersion();
        }
        ed.pushHistory({
          type: `Selected ${count} similar object${count === 1 ? '' : 's'}`,
          icon: createElement(Layers, { size: 14 }),
          color: 'text-violet-400',
        });
      } catch (e) {
        ed.setErrorBanner(`Similar selection failed: ${(e as Error).message}`);
      } finally {
        ed.endProcessing();
      }
    },
    [ed, ensureEncoded],
  );

  const remove = useCallback(async () => {
    if (!ed.image) return;
    const canvas = ed.getMaskCanvas();
    if (!canvas) return;
    ed.setErrorBanner(null);
    ed.startProcessing('remove');
    ed.pushHistory({
      type: 'Processing removal...',
      icon: createElement(RefreshCw, { size: 14, className: 'animate-spin' }),
      color: 'text-amber-400',
    });
    try {
      const imgBlob = await srcToBlob(ed.image);
      const maskBlob = await maskToBlob(canvas);
      const resultUrl = await inpaint(imgBlob, maskBlob);
      ed.setOriginalImage(ed.image);
      ed.setResultImage(resultUrl);
      ed.setImage(resultUrl);
      ed.setShowResult(true);
      ed.setImageId(null); // new image -> need re-encode
      ed.clearCurrentMask();
      ed.pushHistory({
        type: 'Object removed',
        icon: createElement(Sparkles, { size: 14 }),
        color: 'text-violet-400',
      });
    } catch (e) {
      ed.setErrorBanner(`Removal failed: ${(e as Error).message}`);
    } finally {
      ed.endProcessing();
    }
  }, [ed]);

  return { click, prompt, similar, remove };
}
