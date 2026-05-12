import { CheckCircle2, Download, Sparkles } from 'lucide-react';
import { useEditor } from '../state/useEditor';

export function HistoryPanel() {
  const ed = useEditor();

  const onExport = () => {
    if (!ed.image) return;
    const link = document.createElement('a');
    link.download = `clutter-erase-${Date.now()}.png`;
    link.href = ed.image;
    link.click();
    ed.pushHistory({
      type: 'Result exported',
      icon: <Download size={14} />,
      color: 'text-emerald-400',
    });
  };

  return (
    <aside className="w-80 bg-[#0b1326] border-l border-white/5 flex flex-col p-5 space-y-6 overflow-y-auto z-40">
      <div className="space-y-4">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-label">
          Result Preview
        </label>
        <div
          onClick={() => ed.setIsComparing(!ed.isComparing)}
          className="aspect-video bg-[#060e20] rounded-2xl overflow-hidden border border-white/5 group cursor-pointer relative shadow-inner"
        >
          {ed.image ? (
            <img
              src={ed.isComparing ? ed.originalImage || '' : ed.image}
              alt="Preview"
              className={`w-full h-full object-cover transition-all duration-500 ${
                ed.showResult ? 'opacity-100 brightness-110' : 'opacity-60'
              }`}
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

      <div className="space-y-3 flex-1">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest font-label">
          Process History
        </label>
        <div className="space-y-1">
          {ed.history.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-2.5 rounded-xl group transition-all cursor-pointer ${
                item.type.includes('removed')
                  ? 'bg-violet-500/5 border border-violet-500/10'
                  : 'hover:bg-[#171f33]'
              }`}
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

      <div className="pt-4 border-t border-white/5">
        <button
          onClick={onExport}
          disabled={!ed.image}
          className="w-full py-4 bg-[#171f33] text-slate-200 font-black text-sm rounded-full flex items-center justify-center gap-2 hover:bg-[#222a3d] transition-all active:scale-95 border border-white/5 disabled:opacity-40"
        >
          <Download size={18} />
          EXPORT RESULT
        </button>
        <p className="text-center text-[10px] text-slate-600 mt-3 font-label">PNG • High Quality</p>
      </div>
    </aside>
  );
}
