import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { HistoryItem, Mode, ProcessingKind, Tool } from '../types';
import {
  clearMask,
  createMaskCanvas,
  restoreMask,
  snapshotMask,
} from '../lib/mask';

export interface EditorState {
  image: string | null;
  originalImage: string | null;
  resultImage: string | null;
  imageId: string | null;

  intrinsicSize: { width: number; height: number } | null;

  maskVersion: number;

  tool: Tool;
  mode: Mode;
  brushSize: number;
  maskVisible: boolean;
  showResult: boolean;
  isComparing: boolean;

  scale: number;
  position: { x: number; y: number };

  isProcessing: boolean;
  processingKind: ProcessingKind;
  errorBanner: string | null;

  history: HistoryItem[];
  canUndo: boolean;
  canRedo: boolean;
}

export interface EditorActions {
  setImage: (src: string | null) => void;
  setOriginalImage: (src: string | null) => void;
  setResultImage: (src: string | null) => void;
  setImageId: (id: string | null) => void;
  setIntrinsicSize: (s: { width: number; height: number } | null) => void;

  setTool: (t: Tool) => void;
  setMode: (m: Mode) => void;
  setBrushSize: (n: number) => void;
  setMaskVisible: (v: boolean) => void;
  setIsComparing: (v: boolean) => void;
  setShowResult: (v: boolean) => void;
  setScale: (n: number) => void;
  setPosition: (p: { x: number; y: number }) => void;

  startProcessing: (kind: ProcessingKind) => void;
  endProcessing: () => void;
  setErrorBanner: (m: string | null) => void;

  pushHistory: (item: Omit<HistoryItem, 'id' | 'time'>) => void;
  resetHistory: () => void;

  getMaskCanvas: () => HTMLCanvasElement | null;
  bumpMaskVersion: () => void;
  snapshotMaskState: () => Promise<void>;
  undoMask: () => Promise<void>;
  redoMask: () => Promise<void>;
  clearCurrentMask: () => void;
}

const Ctx = createContext<(EditorState & EditorActions) | null>(null);

export function useEditor(): EditorState & EditorActions {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEditor must be inside <EditorProvider>');
  return ctx;
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [image, setImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [intrinsicSize, setIntrinsicSize] = useState<{ width: number; height: number } | null>(null);

  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [maskVersion, setMaskVersion] = useState(0);

  const [tool, setTool] = useState<Tool>('brush');
  const [mode, setMode] = useState<Mode>('idle');
  const [brushSize, setBrushSize] = useState(24);
  const [maskVisible, setMaskVisible] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingKind, setProcessingKind] = useState<ProcessingKind>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  useEffect(() => {
    if (!intrinsicSize) {
      maskCanvasRef.current = null;
      return;
    }
    const cur = maskCanvasRef.current;
    if (
      !cur ||
      cur.width !== intrinsicSize.width ||
      cur.height !== intrinsicSize.height
    ) {
      maskCanvasRef.current = createMaskCanvas(
        intrinsicSize.width,
        intrinsicSize.height,
      );
      setUndoStack([]);
      setRedoStack([]);
      setMaskVersion((v) => v + 1);
    }
  }, [intrinsicSize]);

  const pushHistory = useCallback(
    (item: Omit<HistoryItem, 'id' | 'time'>) => {
      setHistory((prev) => [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time: 'Just now', ...item },
        ...prev.slice(0, 9),
      ]);
    },
    [],
  );

  const resetHistory = useCallback(() => setHistory([]), []);

  const startProcessing = useCallback((kind: ProcessingKind) => {
    setProcessingKind(kind);
    setIsProcessing(true);
  }, []);
  const endProcessing = useCallback(() => {
    setProcessingKind(null);
    setIsProcessing(false);
  }, []);

  const getMaskCanvas = useCallback(() => maskCanvasRef.current, []);
  const bumpMaskVersion = useCallback(() => setMaskVersion((v) => v + 1), []);

  const snapshotMaskState = useCallback(async () => {
    if (!maskCanvasRef.current) return;
    const snap = snapshotMask(maskCanvasRef.current);
    setUndoStack((prev) => [...prev.slice(-49), snap]);
    setRedoStack([]);
  }, []);

  const undoMask = useCallback(async () => {
    const canvas = maskCanvasRef.current;
    if (!canvas || undoStack.length === 0) return;
    const cur = snapshotMask(canvas);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, cur]);
    await restoreMask(canvas, prev);
    bumpMaskVersion();
  }, [undoStack, bumpMaskVersion]);

  const redoMask = useCallback(async () => {
    const canvas = maskCanvasRef.current;
    if (!canvas || redoStack.length === 0) return;
    const cur = snapshotMask(canvas);
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, cur]);
    await restoreMask(canvas, next);
    bumpMaskVersion();
  }, [redoStack, bumpMaskVersion]);

  const clearCurrentMask = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const snap = snapshotMask(canvas);
    setUndoStack((s) => [...s.slice(-49), snap]);
    setRedoStack([]);
    clearMask(canvas);
    bumpMaskVersion();
  }, [bumpMaskVersion]);

  const value = useMemo<EditorState & EditorActions>(
    () => ({
      image,
      originalImage,
      resultImage,
      imageId,
      intrinsicSize,
      maskVersion,
      tool,
      mode,
      brushSize,
      maskVisible,
      showResult,
      isComparing,
      scale,
      position,
      isProcessing,
      processingKind,
      errorBanner,
      history,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,

      setImage,
      setOriginalImage,
      setResultImage,
      setImageId,
      setIntrinsicSize,
      setTool,
      setMode,
      setBrushSize,
      setMaskVisible,
      setIsComparing,
      setShowResult,
      setScale,
      setPosition,
      startProcessing,
      endProcessing,
      setErrorBanner,
      pushHistory,
      resetHistory,
      getMaskCanvas,
      bumpMaskVersion,
      snapshotMaskState,
      undoMask,
      redoMask,
      clearCurrentMask,
    }),
    [
      image,
      originalImage,
      resultImage,
      imageId,
      intrinsicSize,
      maskVersion,
      tool,
      mode,
      brushSize,
      maskVisible,
      showResult,
      isComparing,
      scale,
      position,
      isProcessing,
      processingKind,
      errorBanner,
      history,
      undoStack.length,
      redoStack.length,
      startProcessing,
      endProcessing,
      pushHistory,
      resetHistory,
      getMaskCanvas,
      bumpMaskVersion,
      snapshotMaskState,
      undoMask,
      redoMask,
      clearCurrentMask,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
