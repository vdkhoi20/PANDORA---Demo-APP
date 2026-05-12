<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Clutter Erase — PANDORA Demo App

Interactive web demo for the paper **"Zero-Shot Mass-Similar and Multi-Object Removal in Single Pass"**. The frontend is a React/Vite static site; the inference backend is a FastAPI service that hosts SAM 2 (for mask generation) and PANDORA (for object removal) and is exposed via a free cloudflared tunnel.

```
React / Vite (static)  ──HTTPS──►  FastAPI on GPU box  ──►  SAM 2 + PANDORA
```

## Run the frontend

**Prerequisites:** Node.js 20+.

```bash
npm install
cp .env.example .env.local
# edit .env.local: set VITE_API_BASE to the cloudflared URL printed by server/run.sh
npm run dev
```

The app runs at http://localhost:3000.

## Run the backend (GPU box)

See [server/README.md](server/README.md). TL;DR:

```bash
pip install -r server/requirements.txt
bash server/run.sh
# copy the printed https://*.trycloudflare.com URL into the frontend .env.local
```

The backend expects to find the existing `pandora-removal_demo/` (from `Object_Removal_benchmark_v21`) next to it; override with `PANDORA_DEMO_DIR=/abs/path bash server/run.sh` if it lives elsewhere.

## How it works

| Selection mode | Where it runs | What it does |
|---|---|---|
| Brush / Eraser | client only | Paints into an offscreen 0/255 mask canvas. |
| Click to Auto Mask | `/sam/click` | Single-point prompt to SAM 2; returns the best mask. |
| Select via Prompt | `/sam/prompt` | CLIPSeg → bbox → SAM 2 box-prompted refinement. |
| Select Similar Objects | `/sam/similar` | SAM 2 click mask → CLIP embedding → cosine match against SAM 2 "everything" masks → union. |
| Remove Object | `/inpaint` | Sends `(image, binary mask)` to PANDORA. |

All four selection modes write into the same single source of truth (the mask canvas). "Remove Object" sends a strict 0/255 PNG of that canvas to PANDORA, which returns the inpainted PNG.

## Project layout

```
src/
  App.tsx                composition only
  components/            EditorCanvas, Toolbar, TopBar, HistoryPanel
  hooks/useMaskActions   click / prompt / similar / remove
  lib/                   api, mask, image
  state/useEditor.tsx    EditorProvider, useEditor (context + reducer)
  types.ts
server/                  FastAPI + SAM 2 + PANDORA + cloudflared tunnel
PLAN.md                  the implementation plan this codebase follows
```
