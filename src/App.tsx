/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Brush, 
  Eraser, 
  RotateCcw, 
  Sparkles, 
  MousePointer2, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  SplitSquareVertical, 
  Download, 
  Settings, 
  User,
  Plus,
  CheckCircle2,
  ChevronRight,
  Undo2,
  Redo2,
  RefreshCw,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
type Tool = 'brush' | 'eraser';
type HistoryItem = {
  id: string;
  type: string;
  time: string;
  icon: React.ReactNode;
  color: string;
};

export default function App() {
  const [image, setImage] = useState<string | null>("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2048");
  const [originalImage, setOriginalImage] = useState<string | null>("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2048");
  
  const sampleImages = [
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2048",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=2048",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80&w=2048",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2048",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=2048",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2048"
  ];
  const removeResults = [
  '/result/1.png',
  '/result/2.png',
  '/result/3.png',
  '/result/4.png',
  '/result/5.png'
  ];
  const [removeIndex, setRemoveIndex] = useState(-1);

  const maskResults = [
  '/mask/1.png',
  '/mask/2.png',
  '/mask/3.png'
  ];

  const [maskIndex, setMaskIndex] = useState(-1);

  const [displayImage, setDisplayImage] = useState(image);
  const [isComparing, setIsComparing] = useState(false);
  const [maskVisible, setMaskVisible] = useState(true);
  const [brushSize, setBrushSize] = useState(24);
  const [activeTool, setActiveTool] = useState<Tool>('brush');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasFit, setHasFit] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([
    { id: '1', type: 'System Initialized', time: 'Just now', icon: <Settings size={14} />, color: 'text-slate-400' },
  ]);
  const [mode, setMode] = useState<'idle' | 'auto-mask' | 'select-similar'>('idle');
  // Undo/Redo State
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Zoom/Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [processingType, setProcessingType] = useState<
  'remove' | 'prompt' | 'auto-mask' | 'similar' | null
  >(null);
  // Initialize Canvas and handle image loading
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image;
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(255, 80, 80, 0.06)';
          ctx.lineWidth = brushSize;
          contextRef.current = ctx;
        }

        // 👇 CHỈ FIT LẦN ĐẦU
        if (!hasFit) {
          handleFit();
          setHasFit(true);
        }
      };
  }, [image]);

  const handleFit = () => {
    if (!containerRef.current || !canvasRef.current) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    
    const scaleX = (container.clientWidth - 40) / canvas.width;
    const scaleY = (container.clientHeight - 40) / canvas.height;
    const newScale = Math.min(scaleX, scaleY, 1);
    
    setScale(newScale);
    setPosition({ x: 0, y: 0 });
  };

  const saveState = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL();
    setUndoStack(prev => [...prev, dataUrl]);
    setRedoStack([]); // Clear redo on new action
  };

  const undo = () => {
    if (undoStack.length === 0 || !canvasRef.current || !contextRef.current) return;
    
    const currentState = canvasRef.current.toDataURL();
    setRedoStack(prev => [...prev, currentState]);
    
    const prevState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    setUndoStack(newUndoStack);
    
    const img = new Image();
    img.src = prevState;
    img.onload = () => {
      contextRef.current?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      contextRef.current?.drawImage(img, 0, 0);
      addHistory('Undo performed', <Undo2 size={14} />, 'text-blue-400');
    };
  };

  const redo = () => {
    if (redoStack.length === 0 || !canvasRef.current || !contextRef.current) return;
    
    const currentState = canvasRef.current.toDataURL();
    setUndoStack(prev => [...prev, currentState]);
    
    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    setRedoStack(newRedoStack);
    
    const img = new Image();
    img.src = nextState;
    img.onload = () => {
      contextRef.current?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      contextRef.current?.drawImage(img, 0, 0);
      addHistory('Redo performed', <Redo2 size={14} />, 'text-blue-400');
    };
  };

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = brushSize / scale; // Adjust brush size for zoom
      contextRef.current.globalCompositeOperation = activeTool === 'brush' ? 'source-over' : 'destination-out';
      contextRef.current.strokeStyle = activeTool === 'brush' ? 'rgba(255, 80, 80, 0.06)' : 'rgba(0,0,0,1)';
    }
  }, [brushSize, activeTool, scale]);

  const handleAutoMaskClick = (e: React.MouseEvent | React.TouchEvent) => {
    setProcessingType('auto-mask');
    setIsProcessing(true);

    addHistory(
      'Detecting object...', 
      <RefreshCw size={14} className="animate-spin" />, 
      'text-amber-400'
    );

    const delay = 700 + Math.random() * 800;

    setTimeout(() => {
      
      const nextIndex = (maskIndex + 1) % maskResults.length;

      setImage(maskResults[nextIndex]);
      requestAnimationFrame(() => {
        setDisplayImage(maskResults[nextIndex]);
      });

      setMaskIndex(nextIndex);

      setShowResult(false);
      setUndoStack([]);
      setRedoStack([]);

      setIsProcessing(false);
      setProcessingType(null);
      setMode('idle'); // 👈 QUAN TRỌNG

      addHistory(
        'Auto mask applied', 
        <MousePointer2 size={14} />, 
        'text-violet-400'
      );
    }, delay);
  };

  const handleSelectSimilarClick = (e: React.MouseEvent | React.TouchEvent) => {
    setProcessingType('similar');
    setIsProcessing(true);

    addHistory(
      'Finding similar objects...', 
      <RefreshCw size={14} className="animate-spin" />, 
      'text-amber-400'
    );

    const delay = 800 + Math.random() * 700;

    setTimeout(() => {
      const nextIndex = (maskIndex + 1) % maskResults.length;

      setImage(maskResults[nextIndex]);
      requestAnimationFrame(() => {
        setDisplayImage(maskResults[nextIndex]);
      });
      setMaskIndex(nextIndex);

      setShowResult(false);
      setUndoStack([]);
      setRedoStack([]);

      setIsProcessing(false);
      setProcessingType(null);
      setMode('idle');

      addHistory(
        'Similar objects selected', 
        <Layers size={14} />, 
        'text-violet-400'
      );
    }, delay);
  };

  let lastPoint = { x: 0, y: 0 };
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode === 'auto-mask') {
      handleAutoMaskClick(e);
      return;
    }
    if (mode === 'select-similar') {
      handleSelectSimilarClick(e);
      return;
    }
    if (showResult) return;
    const canvas = canvasRef.current;
    if (!canvas || !contextRef.current) return;

    saveState(); // Save state before starting new stroke

    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // Calculate coordinates relative to canvas intrinsic size
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    lastPoint = { x, y };
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !contextRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    const dx = x - lastPoint.x;
    const dy = y - lastPoint.y;

    if (dx * dx + dy * dy < 100) return; // tránh vẽ dồn

    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();

    lastPoint = { x, y };
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    contextRef.current?.closePath();
    setIsDrawing(false);
    
    // Add to history if not already there for this action
    if (history[0]?.type !== 'Mask updated') {
      addHistory('Mask updated', <Brush size={14} />, 'text-purple-400');
    }
  };

  const addHistory = (type: string, icon: React.ReactNode, color: string) => {
    setHistory(prev => [
      { id: Date.now().toString(), type, time: 'Just now', icon, color },
      ...prev.slice(0, 9)
    ]);
  };

  const handleRemoveObject = () => {
  setProcessingType('remove');
  setIsProcessing(true);
  addHistory('Processing removal...', <RefreshCw size={14} className="animate-spin" />, 'text-amber-400');
  
  setTimeout(() => {
    setIsProcessing(false);
    setProcessingType(null);
    // 👇 THÊM DÒNG NÀY
    const nextIndex = (removeIndex + 1) % removeResults.length;

    setImage(removeResults[nextIndex]);
    requestAnimationFrame(() => {
        setDisplayImage(removeResults[nextIndex]);
      });
    setRemoveIndex(nextIndex);

    setShowResult(true);

    const canvas = canvasRef.current;
    contextRef.current?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);

    addHistory('Object removed', <Sparkles size={14} />, 'text-violet-400');
  }, 2500);
};

  const handleReset = () => {
    setShowResult(false);
    const canvas = canvasRef.current;
    contextRef.current?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
    addHistory('Canvas reset', <RotateCcw size={14} />, 'text-slate-400');
  };

  const handleExport = () => {
    if (!image || !canvasRef.current) return;
    
    const exportCanvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image;
    
    img.onload = () => {
      exportCanvas.width = img.width;
      exportCanvas.height = img.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Draw mask if visible
      if (maskVisible) {
        ctx.drawImage(canvasRef.current!, 0, 0);
      }
      
      const link = document.createElement('a');
      link.download = `Erasing-Clutter-export-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
      
      addHistory('Result exported', <Download size={14} />, 'text-emerald-400');
    };
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.1));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImage(result);
        requestAnimationFrame(() => {
        setDisplayImage(result);
      });
        setOriginalImage(result);
        setShowResult(false);
        setIsComparing(false);
        setUndoStack([]);
        setRedoStack([]);
        addHistory('New image uploaded', <Upload size={14} />, 'text-emerald-400');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden font-body bg-[#0b1326] text-[#dae2fd]">
      {/* Top Navigation */}
      <header className="h-16 flex items-center justify-between px-8 bg-[#060e20]/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="flex items-center gap-12">
          <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 font-headline">
            Erasing Clutter
          </h1>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={() => {
              setImage(null);
              setOriginalImage(null);
              setIsComparing(false);
              setShowResult(false);
              setUndoStack([]);
              setRedoStack([]);
              setHistory([{ id: '1', type: 'System Initialized', time: 'Just now', icon: <Settings size={14} />, color: 'text-slate-400' }]);
            }}
            className="bg-[#d0bcff] text-[#3c0091] px-6 py-2 rounded-full font-bold text-sm transition-all active:scale-95 hover:shadow-lg hover:shadow-violet-500/20"
          >
            New Project
          </button>
          <div className="flex items-center gap-4 text-slate-400">
            <Settings size={20} className="cursor-pointer hover:text-violet-300 transition-colors" />
            <User size={20} className="cursor-pointer hover:text-violet-300 transition-colors" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Controls */}
        <aside className="w-80 bg-[#0b1326] border-r border-white/5 flex flex-col p-5 space-y-6 overflow-y-auto z-40">
          <div className="px-1">
            <h2 className="text-slate-100 font-bold font-headline text-lg">Object Removal App</h2>
          </div>

          {/* Source Image Section */}
          <div className="bg-[#171f33]/50 rounded-2xl p-4 border border-white/5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 font-label">Source Image</label>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*" 
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#222a3d] transition-colors group"
            >
              <Upload className="text-violet-400 mb-2 group-hover:scale-110 transition-transform" size={32} />
              <span className="text-sm font-medium text-slate-200">Upload Image</span>
              <span className="text-[10px] text-slate-500 mt-1">or drag and drop</span>
            </div>
          </div>

          {/* Sample Gallery Section */}
          <div className="bg-[#171f33]/50 rounded-2xl p-4 border border-white/5 space-y-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-label">Sample Gallery</label>
            <div className="grid grid-cols-3 gap-2">
              {sampleImages.map((src, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setImage(src);
                    requestAnimationFrame(() => {
                      setDisplayImage(src);
                    });
                    setOriginalImage(src);
                    setShowResult(false);
                    setIsComparing(false);
                    setUndoStack([]);
                    setRedoStack([]);
                    setHasFit(false); // Re-fit for new image
                    addHistory(`Sample ${idx + 1} selected`, <Layers size={14} />, 'text-cyan-400');
                  }}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${image === src ? 'border-violet-500 scale-95' : 'border-transparent hover:border-white/20'}`}
                >
                  <img 
                    src={src} 
                    alt={`Sample ${idx}`} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Mask Tools Section */}
          <div className="bg-[#171f33]/50 rounded-2xl p-4 border border-white/5 space-y-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-label">Mask Tools</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setActiveTool('brush')}
                className={`flex items-center justify-center gap-2 rounded-full py-2 transition-all border ${activeTool === 'brush' ? 'bg-violet-500/10 text-violet-400 border-violet-400/30' : 'bg-slate-800/50 text-slate-400 border-transparent'}`}
              >
                <Brush size={14} />
                <span className="text-xs font-bold">Brush</span>
              </button>
              <button 
                onClick={() => setActiveTool('eraser')}
                className={`flex items-center justify-center gap-2 rounded-full py-2 transition-all border ${activeTool === 'eraser' ? 'bg-violet-500/10 text-violet-400 border-violet-400/30' : 'bg-slate-800/50 text-slate-400 border-transparent'}`}
              >
                <Eraser size={14} />
                <span className="text-xs font-bold">Eraser</span>
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Brush Size</span>
                <span>{brushSize}px</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="100" 
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-400" 
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Show mask overlay</span>
              <button 
                onClick={() => setMaskVisible(!maskVisible)}
                className={`w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${maskVisible ? 'bg-violet-500' : 'bg-slate-700'}`}
              >
                <motion.div 
                  animate={{ x: maskVisible ? 20 : 0 }}
                  className="w-3 h-3 bg-white rounded-full" 
                />
              </button>
            </div>
            
            <button 
              onClick={() => {
                const canvas = canvasRef.current;
                contextRef.current?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
                addHistory('Mask cleared', <RotateCcw size={14} />, 'text-slate-400');
              }}
              className="w-full py-2 text-xs font-bold text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/5 transition-colors"
            >
              Clear mask
            </button>
          </div>

          {/* Smart Selection Section */}
          <div className="bg-[#171f33]/50 rounded-2xl p-4 border border-white/5 space-y-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-label">Smart Selection</label>
            <div className="relative">
              <input 
                className="w-full bg-[#060e20] border-none rounded-xl text-sm px-4 py-2.5 focus:ring-1 focus:ring-violet-400 text-slate-200 placeholder:text-slate-600" 
                placeholder="Describe object..." 
                type="text" 
              />
              <Sparkles className="absolute right-3 top-2.5 text-violet-400" size={16} />
            </div>
            
            <div className="space-y-2">
              <button 
               onClick={() => {
                  setProcessingType('prompt');
                  setIsProcessing(true);
                  addHistory('Understanding prompt...', <RefreshCw size={14} className="animate-spin" />, 'text-amber-400');

                  setTimeout(() => {
                    
                    const nextIndex = (maskIndex + 1) % maskResults.length;

                    setImage(maskResults[nextIndex]);
                    requestAnimationFrame(() => {
                      setDisplayImage(maskResults[nextIndex]);
                    });
                    setMaskIndex(nextIndex);

                    setShowResult(false);
                    setUndoStack([]);
                    setRedoStack([]);

                    setIsProcessing(false);
                    setProcessingType(null);
                    addHistory('Object selected via prompt', <Sparkles size={14} />, 'text-violet-400');
                  }, 1200);
                }}
                className="w-full text-left px-4 py-2.5 bg-[#222a3d] rounded-xl text-[11px] font-bold flex items-center justify-between group hover:text-violet-400 transition-colors"
              >
                <span>Select via Prompt</span>
                <ChevronRight size={14} className="opacity-50 group-hover:opacity-100" />
              </button>
              <button className="w-full text-left px-4 py-2.5 bg-[#222a3d] rounded-xl text-[11px] font-bold flex items-center justify-between group hover:text-violet-400 transition-colors"
                onClick={() => {
                  setMode('auto-mask');
                  addHistory(
                    'Click on object to auto mask', 
                    <MousePointer2 size={14} />, 
                    'text-blue-400'
                  );
                }}
              >
                <span>Click to Auto Mask</span>
                <MousePointer2 size={14} />
              </button>
              <button 
                onClick={() => {
                  setMode('select-similar');
                  addHistory(
                    'Click on object to find similar', 
                    <Layers size={14} />, 
                    'text-blue-400'
                  );
                }}
                className="w-full text-left px-4 py-2.5 bg-[#222a3d] rounded-xl text-[11px] font-bold flex items-center justify-between group hover:text-violet-400 transition-colors">
                <span>Select Similar Objects</span>
                <Layers size={14} className="opacity-50 group-hover:opacity-100" />
              </button>
            </div>
          </div>

          {/* Actions Section */}
          <div className="pt-2 space-y-3">
            <button 
              disabled={isProcessing || !image}
              onClick={handleRemoveObject}
              className="w-full py-4 ai-gradient text-[#3c0091] font-black text-sm rounded-full shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : (
                <Sparkles size={18} />
              )}
              {isProcessing ? 'PROCESSING...' : 'REMOVE OBJECT'}
            </button>
            
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={undo}
                disabled={undoStack.length === 0}
                className="flex flex-col items-center py-2 bg-[#171f33]/50 rounded-xl text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-20"
              >
                <Undo2 size={18} />
                <span className="text-[9px] font-bold mt-1">Undo</span>
              </button>
              <button 
                onClick={redo}
                disabled={redoStack.length === 0}
                className="flex flex-col items-center py-2 bg-[#171f33]/50 rounded-xl text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-20"
              >
                <Redo2 size={18} />
                <span className="text-[9px] font-bold mt-1">Redo</span>
              </button>
              <button 
                onClick={handleReset}
                className="flex flex-col items-center py-2 bg-[#171f33]/50 rounded-xl text-slate-500 hover:text-slate-200 transition-colors"
              >
                <RotateCcw size={18} />
                <span className="text-[9px] font-bold mt-1">Reset</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Center Panel - Canvas */}
        <main className="flex-1 relative bg-[#060e20] flex flex-col">
          {/* Canvas Toolbar */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center bg-[#171f33]/80 backdrop-blur-md rounded-full px-6 py-2 border border-white/5 z-30 gap-6 shadow-2xl">
            <div className="flex items-center gap-4 text-slate-400">
              <button onClick={handleZoomIn} className="hover:text-violet-400 transition-colors"><ZoomIn size={18} /></button>
              <span className="text-xs font-bold font-label w-10 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={handleZoomOut} className="hover:text-violet-400 transition-colors"><ZoomOut size={18} /></button>
            </div>
            <div className="h-4 w-[1px] bg-white/10"></div>
            <button 
              onClick={handleFit}
              className="text-xs font-bold text-slate-400 hover:text-violet-400 transition-colors flex items-center gap-2"
            >
              <Maximize size={14} />
              Fit
            </button>
            <div className="h-4 w-[1px] bg-white/10"></div>
            <button 
              onClick={() => setIsComparing(!isComparing)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isComparing ? 'bg-violet-500 text-white' : 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20'}`}
            >
              <SplitSquareVertical size={14} />
              {isComparing ? 'Showing Before' : 'Before / After'}
            </button>
          </div>

          {/* Image Workspace */}
          <div className="flex-1 p-12 flex items-center justify-center overflow-hidden" ref={containerRef}>
            <div 
              className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/5 bg-[#131b2e] flex items-center justify-center transition-transform duration-200 ease-out"
              style={{ 
              transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
              transformOrigin: 'center center',
              cursor: mode === 'auto-mask' || mode === 'select-similar'
                ? 'pointer' 
                : isDrawing 
                  ? 'crosshair' 
                  : 'default'
            }}
            >
              {image ? (
                <div className="relative w-full h-full cursor-crosshair group">
                  <AnimatePresence mode="wait">
                    <motion.div
                      // key={isComparing ? 'original' : (showResult ? 'result' : 'editing')}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="w-full h-full"
                    >
                      <img 
                        src={isComparing ? originalImage || '' : image || ''} 
                        alt="Canvas" 
                        className={`w-full h-full object-contain transition-all duration-700 ${showResult && !isComparing ? 'brightness-105 saturate-105' : ''}`}
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* Drawing Canvas Overlay */}
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className={`absolute inset-0 z-10 w-full h-full object-contain pointer-events-auto transition-opacity duration-300 ${maskVisible && !isComparing ? 'opacity-100' : 'opacity-0'}`}
                  />

                  {/* Processing Overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                      <div className="w-16 h-16 border-4 border-violet-400/20 border-t-violet-400 rounded-full animate-spin mb-4"></div>
                      <p className="text-violet-400 font-black tracking-widest text-sm animate-pulse">
                        {processingType === 'remove' && 'DISSOLVING ATTENTION...'}
                        {processingType === 'prompt' && 'UNDERSTANDING PROMPT...'}
                        {processingType === 'auto-mask' && 'DETECTING OBJECT...'}
                        {processingType === 'similar' && 'MATCHING PATTERNS...'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center text-slate-500">
                  <Upload size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-medium">No image selected</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 px-6 py-2 bg-violet-500/10 text-violet-400 rounded-full text-xs font-bold hover:bg-violet-500/20 transition-all"
                  >
                    Select File
                  </button>
                </div>
              )}

              {/* Canvas Info */}

            </div>
          </div>

          {/* Floating Action Bar */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#171f33]/60 backdrop-blur-2xl px-5 py-3 rounded-2xl shadow-2xl border border-white/5 z-30">
            <button className="p-2.5 text-violet-400 bg-violet-400/10 rounded-xl transition-all"><MousePointer2 size={20} /></button>
            <button className="p-2.5 text-slate-400 hover:text-slate-200 rounded-xl transition-all"><Brush size={20} /></button>
            <button className="p-2.5 text-slate-400 hover:text-slate-200 rounded-xl transition-all"><Sparkles size={20} /></button>
            <button className="p-2.5 text-slate-400 hover:text-slate-200 rounded-xl transition-all"><Maximize size={20} /></button>
            <div className="w-[1px] h-6 bg-white/10 mx-2"></div>
            <button className="p-2.5 text-slate-400 hover:text-slate-200 rounded-xl transition-all"><Layers size={20} /></button>
          </div>
        </main>

        {/* Right Panel - Results & History */}
        <aside className="w-80 bg-[#0b1326] border-l border-white/5 flex flex-col p-5 space-y-6 overflow-y-auto z-40">
          {/* Result Preview Section */}
          <div className="space-y-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-label">Result Preview</label>
            <div 
              onClick={() => setIsComparing(!isComparing)}
              className="aspect-video bg-[#060e20] rounded-2xl overflow-hidden border border-white/5 group cursor-pointer relative shadow-inner"
            >
              {image ? (
                <img 
                  src={isComparing ? originalImage || '' : image} 
                  alt="Preview" 
                  className={`w-full h-full object-cover transition-all duration-500 ${showResult ? 'opacity-100 brightness-110' : 'opacity-60'}`}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-700">
                  <Sparkles size={24} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#060e20] to-transparent flex items-end p-4">
                <span className="text-xs font-bold text-violet-300">Final Composition</span>
              </div>
            </div>
          </div>


          {/* Process History Section */}
          <div className="space-y-3 flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-label">Process History</label>
            <div className="space-y-1">
              {history.map((item) => (
                <div 
                  key={item.id} 
                  className={`flex items-center gap-3 p-2.5 rounded-xl group transition-all cursor-pointer ${item.type.includes('removed') ? 'bg-violet-500/5 border border-violet-500/10' : 'hover:bg-[#171f33]'}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#171f33] flex items-center justify-center shadow-sm">
                    <span className={item.color}>{item.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-slate-200">{item.type}</p>
                    <p className="text-[9px] text-slate-600 font-label">{item.time}</p>
                  </div>
                  {item.type.includes('removed') && <CheckCircle2 size={14} className="text-violet-400" />}
                </div>
              ))}
            </div>
          </div>

          {/* Export Section */}
          <div className="pt-4 border-t border-white/5">
            <button 
              onClick={handleExport}
              className="w-full py-4 bg-[#171f33] text-slate-200 font-black text-sm rounded-full flex items-center justify-center gap-2 hover:bg-[#222a3d] transition-all active:scale-95 border border-white/5"
            >
              <Download size={18} />
              EXPORT RESULT
            </button>
            <p className="text-center text-[10px] text-slate-600 mt-3 font-label">PNG • High Quality</p>
          </div>
        </aside>
      </div>

      {/* Mobile Nav Fallback */}
      <nav className="md:hidden h-16 bg-[#0b1326] border-t border-white/5 flex items-center justify-around px-4">
        <button className="flex flex-col items-center text-violet-400">
          <Sparkles size={20} />
          <span className="text-[9px] font-bold mt-1">Lab</span>
        </button>
        <button className="flex flex-col items-center text-slate-500">
          <Brush size={20} />
          <span className="text-[9px] font-bold mt-1">Tools</span>
        </button>
        <button className="flex flex-col items-center text-slate-500">
          <RotateCcw size={20} />
          <span className="text-[9px] font-bold mt-1">History</span>
        </button>
        <button className="flex flex-col items-center text-slate-500">
          <User size={20} />
          <span className="text-[9px] font-bold mt-1">Profile</span>
        </button>
      </nav>
    </div>
  );
}
