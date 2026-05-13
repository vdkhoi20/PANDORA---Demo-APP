import { useCallback, useRef } from 'react';
import { Brush, Layers, Maximize, MousePointer2, Settings, Sparkles, User } from 'lucide-react';
import { EditorCanvas } from './components/EditorCanvas';
import { HistoryPanel } from './components/HistoryPanel';
import { Toolbar } from './components/Toolbar';
import { TopBar } from './components/TopBar';
import { EditorProvider, useEditor } from './state/useEditor';
import { apiBaseConfigured } from './lib/api';

function Shell() {
  const ed = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);

  const onFit = useCallback(() => {
    if (!containerRef.current || !ed.intrinsicSize) return;
    const cw = containerRef.current.clientWidth - 40;
    const ch = containerRef.current.clientHeight - 40;
    const s = Math.min(cw / ed.intrinsicSize.width, ch / ed.intrinsicSize.height, 1);
    ed.setScale(Number.isFinite(s) && s > 0 ? s : 1);
    ed.setPosition({ x: 0, y: 0 });
  }, [ed]);

  const onNewProject = useCallback(() => {
    ed.setImage(null);
    ed.setOriginalImage(null);
    ed.setResultImage(null);
    ed.setShowResult(false);
    ed.setIsComparing(false);
    ed.setImageId(null);
    ed.setMode('idle');
    ed.resetHistory();
    ed.pushHistory({
      type: 'System Initialized',
      icon: <Settings size={14} />,
      color: 'text-slate-400',
    });
  }, [ed]);

  return (
    <div className="flex flex-col h-screen overflow-hidden font-body bg-[#0b1326] text-[#dae2fd]">
      <header className="h-16 flex items-center justify-between px-8 bg-[#060e20]/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="flex items-center gap-12">
          <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 font-headline">
            Erasing Clutter
          </h1>
        </div>

        <div className="flex items-center gap-6">
          {!apiBaseConfigured() && (
            <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-3 py-1 rounded-full">
              VITE_API_BASE not set
            </span>
          )}
          <button
            onClick={onNewProject}
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
        <Toolbar />

        <main className="flex-1 relative bg-[#060e20] flex flex-col">
          <TopBar onFit={onFit} />
          <EditorCanvas containerRef={containerRef} />

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#171f33]/60 backdrop-blur-2xl px-5 py-3 rounded-2xl shadow-2xl border border-white/5 z-30">
            <button className="p-2.5 text-violet-400 bg-violet-400/10 rounded-xl transition-all">
              <MousePointer2 size={20} />
            </button>
            <button className="p-2.5 text-slate-400 hover:text-slate-200 rounded-xl transition-all">
              <Brush size={20} />
            </button>
            <button className="p-2.5 text-slate-400 hover:text-slate-200 rounded-xl transition-all">
              <Sparkles size={20} />
            </button>
            <button className="p-2.5 text-slate-400 hover:text-slate-200 rounded-xl transition-all">
              <Maximize size={20} />
            </button>
            <div className="w-[1px] h-6 bg-white/10 mx-2"></div>
            <button className="p-2.5 text-slate-400 hover:text-slate-200 rounded-xl transition-all">
              <Layers size={20} />
            </button>
          </div>
        </main>

        <HistoryPanel />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  );
}
