import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Upload } from 'lucide-react';
import { useEditor } from '../state/useEditor';
import { useMaskActions } from '../hooks/useMaskActions';
import { useImageUpload } from '../hooks/useImageUpload';
import { renderOverlay, strokeBrush, stampBrush } from '../lib/mask';
import { loadImage } from '../lib/image';

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function EditorCanvas({ containerRef }: Props) {
  const ed = useEditor();
  const actions = useMaskActions();
  const { onInputChange, dragHandlers, isDragOver } = useImageUpload();
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const placeholderFileInputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [, force] = useState(0);

  // Load image -> set intrinsic size -> fit
  useEffect(() => {
    if (!ed.image) {
      ed.setIntrinsicSize(null);
      return;
    }
    let cancelled = false;
    loadImage(ed.image)
      .then((img) => {
        if (cancelled) return;
        imgRef.current = img;
        ed.setIntrinsicSize({ width: img.naturalWidth, height: img.naturalHeight });
        // Fit on every new image
        if (containerRef.current) {
          const cw = containerRef.current.clientWidth - 40;
          const ch = containerRef.current.clientHeight - 40;
          const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1);
          ed.setScale(Number.isFinite(s) && s > 0 ? s : 1);
          ed.setPosition({ x: 0, y: 0 });
        }
        force((n) => n + 1);
      })
      .catch((err) => ed.setErrorBanner(err.message));
    return () => {
      cancelled = true;
    };
  }, [ed.image]);

  // Re-render overlay whenever the mask changes
  useEffect(() => {
    const overlay = overlayRef.current;
    const mask = ed.getMaskCanvas();
    if (!overlay || !mask) return;
    renderOverlay(mask, overlay);
  }, [ed.maskVersion, ed.intrinsicSize]);

  const eventToImageCoords = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const overlay = overlayRef.current;
      if (!overlay) return null;
      const rect = overlay.getBoundingClientRect();
      const cx = 'touches' in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX;
      const cy = 'touches' in e ? e.touches[0]?.clientY ?? 0 : (e as React.MouseEvent).clientY;
      const x = ((cx - rect.left) / rect.width) * overlay.width;
      const y = ((cy - rect.top) / rect.height) * overlay.height;
      return { x, y };
    },
    [],
  );

  const onPointerDown = async (e: React.MouseEvent | React.TouchEvent) => {
    if (!ed.image || ed.showResult || ed.isProcessing) return;
    const p = eventToImageCoords(e);
    if (!p) return;

    if (ed.mode === 'click-mask') {
      actions.click(p);
      return;
    }
    if (ed.mode === 'select-similar') {
      actions.similar(p);
      return;
    }
    // Brush / eraser
    const mask = ed.getMaskCanvas();
    if (!mask) return;
    await ed.snapshotMaskState();
    const radius = (ed.brushSize / 2) / Math.max(0.01, ed.scale);
    stampBrush(mask, p.x, p.y, radius, ed.tool === 'eraser');
    ed.bumpMaskVersion();
    isDrawingRef.current = true;
    lastPointRef.current = p;
  };

  const onPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const p = eventToImageCoords(e);
    if (!p) return;
    const mask = ed.getMaskCanvas();
    if (!mask) return;
    const last = lastPointRef.current ?? p;
    const radius = (ed.brushSize / 2) / Math.max(0.01, ed.scale);
    strokeBrush(mask, last.x, last.y, p.x, p.y, radius, ed.tool === 'eraser');
    ed.bumpMaskVersion();
    lastPointRef.current = p;
  };

  const onPointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const cursor = useMemo(() => {
    if (ed.mode === 'click-mask' || ed.mode === 'select-similar') return 'pointer';
    if (ed.isProcessing) return 'wait';
    return 'crosshair';
  }, [ed.mode, ed.isProcessing]);

  return (
    <div className="flex-1 p-12 flex items-center justify-center overflow-hidden" ref={containerRef}>
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/5 bg-[#131b2e] flex items-center justify-center transition-transform duration-200 ease-out"
        style={{
          transform: `scale(${ed.scale}) translate(${ed.position.x}px, ${ed.position.y}px)`,
          transformOrigin: 'center center',
          cursor,
        }}
      >
        {ed.image ? (
          <div className="relative w-full h-full group">
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full"
              >
                <img
                  src={ed.isComparing ? ed.originalImage || '' : ed.image || ''}
                  alt="Canvas"
                  className={`w-full h-full object-contain transition-all duration-700 ${
                    ed.showResult && !ed.isComparing ? 'brightness-105 saturate-105' : ''
                  }`}
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </AnimatePresence>

            <canvas
              ref={overlayRef}
              onMouseDown={onPointerDown}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
              onTouchStart={onPointerDown}
              onTouchMove={onPointerMove}
              onTouchEnd={onPointerUp}
              className={`absolute inset-0 z-10 w-full h-full object-contain pointer-events-auto transition-opacity duration-300 ${
                ed.maskVisible && !ed.isComparing ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {ed.isProcessing && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                <div className="w-16 h-16 border-4 border-violet-400/20 border-t-violet-400 rounded-full animate-spin mb-4"></div>
                <p className="text-violet-400 font-black tracking-widest text-sm animate-pulse">
                  {ed.processingKind === 'remove' && 'DISSOLVING ATTENTION...'}
                  {ed.processingKind === 'prompt' && 'UNDERSTANDING PROMPT...'}
                  {ed.processingKind === 'click-mask' && 'DETECTING OBJECT...'}
                  {ed.processingKind === 'similar' && 'MATCHING PATTERNS...'}
                  {ed.processingKind === 'encode' && 'PREPARING IMAGE...'}
                </p>
              </div>
            )}

            {ed.errorBanner && (
              <div className="absolute bottom-3 left-3 right-3 bg-red-500/15 border border-red-500/40 text-red-200 text-xs px-3 py-2 rounded-lg z-30 flex items-center justify-between">
                <span>{ed.errorBanner}</span>
                <button
                  onClick={() => ed.setErrorBanner(null)}
                  className="ml-2 text-red-300 hover:text-white"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            {...dragHandlers}
            onClick={() => placeholderFileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center px-24 py-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
              isDragOver
                ? 'border-violet-400 text-violet-200 bg-violet-500/10'
                : 'border-white/10 text-slate-500 hover:bg-[#131b2e]'
            }`}
          >
            <Upload size={48} className={`mb-4 transition-opacity ${isDragOver ? 'opacity-80' : 'opacity-30'}`} />
            <p className="text-sm font-medium">
              {isDragOver ? 'Drop to upload' : 'No image selected'}
            </p>
            <p className="text-xs mt-2 opacity-60">Click or drag &amp; drop an image</p>
            <input
              ref={placeholderFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onInputChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
