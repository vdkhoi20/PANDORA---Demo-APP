import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Brush,
  ChevronRight,
  Eraser,
  Layers,
  MousePointer2,
  Redo2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Undo2,
  Upload,
} from 'lucide-react';
import { useEditor } from '../state/useEditor';
import { useMaskActions } from '../hooks/useMaskActions';
import { useImageUpload } from '../hooks/useImageUpload';

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2048',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=2048',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80&w=2048',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2048',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=2048',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2048',
];

export function Toolbar() {
  const ed = useEditor();
  const actions = useMaskActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [promptText, setPromptText] = useState('');
  const { onInputChange, dragHandlers, isDragOver } = useImageUpload();

  const pickSample = (src: string, idx: number) => {
    ed.setImage(src);
    ed.setOriginalImage(src);
    ed.setResultImage(null);
    ed.setShowResult(false);
    ed.setIsComparing(false);
    ed.setImageId(null);
    ed.setMode('idle');
    ed.pushHistory({
      type: `Sample ${idx + 1} selected`,
      icon: <Layers size={14} />,
      color: 'text-cyan-400',
    });
  };

  const submitPrompt = () => {
    if (!promptText.trim()) return;
    actions.prompt(promptText);
  };

  return (
    <aside className="w-80 bg-[#0b1326] border-r border-white/5 flex flex-col p-5 space-y-6 overflow-y-auto z-40">
      <div className="px-1">
        <h2 className="text-slate-100 font-bold font-headline text-lg">Clutter Erase</h2>
      </div>

      {/* Source Image */}
      <div className="bg-[#171f33]/50 rounded-2xl p-4 border border-white/5">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 font-label">
          Source Image
        </label>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onInputChange}
          className="hidden"
          accept="image/*"
        />
        <div
          {...dragHandlers}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group ${
            isDragOver
              ? 'border-violet-400 bg-violet-500/10'
              : 'border-white/10 hover:bg-[#222a3d]'
          }`}
        >
          <Upload
            className={`mb-2 group-hover:scale-110 transition-transform ${
              isDragOver ? 'text-violet-300' : 'text-violet-400'
            }`}
            size={32}
          />
          <span className="text-sm font-medium text-slate-200">
            {isDragOver ? 'Drop to upload' : 'Upload Image'}
          </span>
          <span className="text-[10px] text-slate-500 mt-1">or drag and drop</span>
        </div>
      </div>

      {/* Sample Gallery */}
      <div className="bg-[#171f33]/50 rounded-2xl p-4 border border-white/5 space-y-3">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-label">
          Sample Gallery
        </label>
        <div className="grid grid-cols-3 gap-2">
          {SAMPLE_IMAGES.map((src, idx) => (
            <button
              key={idx}
              onClick={() => pickSample(src, idx)}
              className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                ed.image === src ? 'border-violet-500 scale-95' : 'border-transparent hover:border-white/20'
              }`}
            >
              <img src={src} alt={`Sample ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      </div>

      {/* Mask Tools */}
      <div className="bg-[#171f33]/50 rounded-2xl p-4 border border-white/5 space-y-4">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-label">
          Mask Tools
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              ed.setTool('brush');
              ed.setMode('idle');
            }}
            className={`flex items-center justify-center gap-2 rounded-full py-2 transition-all border ${
              ed.tool === 'brush' && ed.mode === 'idle'
                ? 'bg-violet-500/10 text-violet-400 border-violet-400/30'
                : 'bg-slate-800/50 text-slate-400 border-transparent'
            }`}
          >
            <Brush size={14} />
            <span className="text-xs font-bold">Brush</span>
          </button>
          <button
            onClick={() => {
              ed.setTool('eraser');
              ed.setMode('idle');
            }}
            className={`flex items-center justify-center gap-2 rounded-full py-2 transition-all border ${
              ed.tool === 'eraser' && ed.mode === 'idle'
                ? 'bg-violet-500/10 text-violet-400 border-violet-400/30'
                : 'bg-slate-800/50 text-slate-400 border-transparent'
            }`}
          >
            <Eraser size={14} />
            <span className="text-xs font-bold">Eraser</span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Brush Size</span>
            <span>{ed.brushSize}px</span>
          </div>
          <input
            type="range"
            min="5"
            max="100"
            value={ed.brushSize}
            onChange={(e) => ed.setBrushSize(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Show mask overlay</span>
          <button
            onClick={() => ed.setMaskVisible(!ed.maskVisible)}
            className={`w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${
              ed.maskVisible ? 'bg-violet-500' : 'bg-slate-700'
            }`}
          >
            <motion.div animate={{ x: ed.maskVisible ? 20 : 0 }} className="w-3 h-3 bg-white rounded-full" />
          </button>
        </div>

        <button
          onClick={() => {
            ed.clearCurrentMask();
            ed.pushHistory({
              type: 'Mask cleared',
              icon: <RotateCcw size={14} />,
              color: 'text-slate-400',
            });
          }}
          className="w-full py-2 text-xs font-bold text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/5 transition-colors"
        >
          Clear mask
        </button>
      </div>

      {/* Smart Selection */}
      <div className="bg-[#171f33]/50 rounded-2xl p-4 border border-white/5 space-y-4">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-label">
          Smart Selection
        </label>
        <div className="relative">
          <input
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitPrompt()}
            className="w-full bg-[#060e20] border-none rounded-xl text-sm px-4 py-2.5 focus:ring-1 focus:ring-violet-400 text-slate-200 placeholder:text-slate-600"
            placeholder="Describe object..."
            type="text"
            disabled={ed.isProcessing || !ed.image}
          />
          <Sparkles className="absolute right-3 top-2.5 text-violet-400" size={16} />
        </div>

        <div className="space-y-2">
          <button
            onClick={submitPrompt}
            disabled={ed.isProcessing || !ed.image || !promptText.trim()}
            className="w-full text-left px-4 py-2.5 bg-[#222a3d] rounded-xl text-[11px] font-bold flex items-center justify-between group hover:text-violet-400 transition-colors disabled:opacity-50"
          >
            <span>Select via Prompt</span>
            <ChevronRight size={14} className="opacity-50 group-hover:opacity-100" />
          </button>
          <button
            onClick={() => {
              const next = ed.mode === 'click-mask' ? 'idle' : 'click-mask';
              ed.setMode(next);
              if (next === 'click-mask') {
                ed.pushHistory({
                  type: 'Click on object to auto mask',
                  icon: <MousePointer2 size={14} />,
                  color: 'text-blue-400',
                });
              }
            }}
            disabled={ed.isProcessing || !ed.image}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-between group transition-colors disabled:opacity-50 ${
              ed.mode === 'click-mask'
                ? 'bg-violet-500/15 text-violet-400 border border-violet-400/30'
                : 'bg-[#222a3d] hover:text-violet-400'
            }`}
          >
            <span>Click to Auto Mask</span>
            <MousePointer2 size={14} />
          </button>
          <button
            onClick={() => {
              const next = ed.mode === 'select-similar' ? 'idle' : 'select-similar';
              ed.setMode(next);
              if (next === 'select-similar') {
                ed.pushHistory({
                  type: 'Click on object to find similar',
                  icon: <Layers size={14} />,
                  color: 'text-blue-400',
                });
              }
            }}
            disabled={ed.isProcessing || !ed.image}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-between group transition-colors disabled:opacity-50 ${
              ed.mode === 'select-similar'
                ? 'bg-violet-500/15 text-violet-400 border border-violet-400/30'
                : 'bg-[#222a3d] hover:text-violet-400'
            }`}
          >
            <span>Select Similar Objects</span>
            <Layers size={14} className="opacity-50 group-hover:opacity-100" />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 space-y-3">
        <button
          disabled={ed.isProcessing || !ed.image}
          onClick={actions.remove}
          className="w-full py-4 ai-gradient text-[#3c0091] font-black text-sm rounded-full shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ed.isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
          {ed.isProcessing ? 'PROCESSING...' : 'REMOVE OBJECT'}
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              ed.undoMask();
              ed.pushHistory({
                type: 'Undo performed',
                icon: <Undo2 size={14} />,
                color: 'text-blue-400',
              });
            }}
            disabled={!ed.canUndo}
            className="flex flex-col items-center py-2 bg-[#171f33]/50 rounded-xl text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-20"
          >
            <Undo2 size={18} />
            <span className="text-[9px] font-bold mt-1">Undo</span>
          </button>
          <button
            onClick={() => {
              ed.redoMask();
              ed.pushHistory({
                type: 'Redo performed',
                icon: <Redo2 size={14} />,
                color: 'text-blue-400',
              });
            }}
            disabled={!ed.canRedo}
            className="flex flex-col items-center py-2 bg-[#171f33]/50 rounded-xl text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-20"
          >
            <Redo2 size={18} />
            <span className="text-[9px] font-bold mt-1">Redo</span>
          </button>
          <button
            onClick={() => {
              ed.clearCurrentMask();
              ed.setShowResult(false);
              ed.pushHistory({
                type: 'Canvas reset',
                icon: <RotateCcw size={14} />,
                color: 'text-slate-400',
              });
            }}
            className="flex flex-col items-center py-2 bg-[#171f33]/50 rounded-xl text-slate-500 hover:text-slate-200 transition-colors"
          >
            <RotateCcw size={18} />
            <span className="text-[9px] font-bold mt-1">Reset</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
