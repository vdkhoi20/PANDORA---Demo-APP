import { Maximize, SplitSquareVertical, ZoomIn, ZoomOut } from 'lucide-react';
import { useEditor } from '../state/useEditor';

interface Props {
  onFit: () => void;
}

export function TopBar({ onFit }: Props) {
  const ed = useEditor();

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center bg-[#171f33]/80 backdrop-blur-md rounded-full px-6 py-2 border border-white/5 z-30 gap-6 shadow-2xl">
      <div className="flex items-center gap-4 text-slate-400">
        <button
          onClick={() => ed.setScale(Math.min(ed.scale + 0.1, 3))}
          className="hover:text-violet-400 transition-colors"
        >
          <ZoomIn size={18} />
        </button>
        <span className="text-xs font-bold font-label w-10 text-center">
          {Math.round(ed.scale * 100)}%
        </span>
        <button
          onClick={() => ed.setScale(Math.max(ed.scale - 0.1, 0.1))}
          className="hover:text-violet-400 transition-colors"
        >
          <ZoomOut size={18} />
        </button>
      </div>
      <div className="h-4 w-[1px] bg-white/10"></div>
      <button
        onClick={onFit}
        className="text-xs font-bold text-slate-400 hover:text-violet-400 transition-colors flex items-center gap-2"
      >
        <Maximize size={14} />
        Fit
      </button>
      <div className="h-4 w-[1px] bg-white/10"></div>
      <button
        onClick={() => ed.setIsComparing(!ed.isComparing)}
        disabled={!ed.originalImage}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-30 ${
          ed.isComparing
            ? 'bg-violet-500 text-white'
            : 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20'
        }`}
      >
        <SplitSquareVertical size={14} />
        {ed.isComparing ? 'Showing Before' : 'Before / After'}
      </button>
    </div>
  );
}
