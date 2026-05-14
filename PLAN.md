# Clutter Erase — Real SAM + PANDORA Integration Plan

Replace the mocked behavior in [src/App.tsx](src/App.tsx) with a real pipeline:

```
Browser (React)                          GPU box (FastAPI + cloudflared)
┌────────────────────┐    HTTPS tunnel   ┌──────────────────────────────────┐
│ Brush  ─► binary mask (client only)    │  SAM 2 (image embed cache)       │
│ Click  ─► /sam/click  ────────────────►│  CLIPSeg → SAM 2 (text → box)    │
│ Prompt ─► /sam/prompt ────────────────►│  SAM 2 everything + CLIP cosine  │
│ Similar─► /sam/similar ───────────────►│  PANDORA (existing inference)    │
│ Remove ─► /inpaint   ─────────────────►│                                  │
└────────────────────┘                   └──────────────────────────────────┘
```

The existing Gradio app at `Object_Removal_benchmark_v21/pandora-removal_demo/app.py` keeps working untouched as `/gradio` for backup; new REST endpoints live alongside it on the same FastAPI server. cloudflared tunnels port 8000 to a public `*.trycloudflare.com` URL that the React app reads from `VITE_API_BASE`.

---

## 1. Server (new directory: `server/` inside this repo, deployed onto the GPU box)

### 1.1 File layout

```
server/
  main.py            # FastAPI app, mounts existing Gradio demo at /gradio
  routes_sam.py      # /sam/encode, /sam/click, /sam/prompt, /sam/similar
  routes_inpaint.py  # /inpaint  (calls PandoraRemoval directly)
  sam_engine.py      # SAM 2 wrapper + per-image embedding cache
  clipseg_engine.py  # text → bbox via CLIPSeg
  similar_engine.py  # SAM 2 AutomaticMaskGenerator + CLIP image-embed cosine
  schemas.py         # pydantic request/response models
  cache.py           # LRU image-id → (PIL image, SAM embedding, "everything" masks, CLIP feats)
  requirements.txt
  README.md          # how to install + run on the GPU box
  run.sh             # `uvicorn server.main:app ... & cloudflared tunnel --url http://localhost:8000`
```

The server expects to live next to the existing `pandora-removal_demo/` so it can import `from src.pandora_removal import PandoraRemoval, PandoraConfig`. README documents the symlink/`PYTHONPATH` setup.

### 1.2 Endpoints

All POSTs return JSON; binary masks/images are PNG-encoded base64 strings (`data:image/png;base64,...`) to keep the client simple. `image_id` is a short SHA-1 of the uploaded image bytes.

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/sam/encode` | multipart `image: File` | `{image_id, width, height}` — caches PIL image + SAM embedding + (lazy) CLIP feats |
| `POST` | `/sam/click` | JSON `{image_id, points: [[x,y]], labels: [0|1]}` | `{mask_png_b64}` (binary 0/255, original size) |
| `POST` | `/sam/prompt` | JSON `{image_id, text}` | `{mask_png_b64, bbox: [x,y,w,h]}` |
| `POST` | `/sam/similar` | JSON `{image_id, points: [[x,y]], threshold?: 0.7}` | `{mask_png_b64, count}` |
| `POST` | `/inpaint` | multipart `image: File, mask: File` plus optional form fields `border_size, guidance_scale, percentile, step_query, num_steps, seed` | `image/png` stream of result |
| `GET`  | `/health` | — | `{ok: true, sam: bool, pandora: bool}` |
| `*`    | `/gradio/*` | — | existing Gradio UI mounted via `gr.mount_gradio_app` |

Defaults if `/inpaint` form fields are omitted match `app.py`: `border=1, guidance=1.3, percentile=95, step_query=45, num_steps=50, seed=-1`. The React UI does not expose these — they stay server-side.

### 1.3 Models

- **SAM 2**: `sam2.1_hiera_base_plus.pt` via `sam2` package (`pip install git+https://github.com/facebookresearch/sam2.git`). One `SAM2ImagePredictor` is reused; embeddings are cached per `image_id`.
- **CLIPSeg**: `CIDAS/clipseg-rd64-refined` (`transformers`). Heatmap → threshold (Otsu or 0.5) → bbox → fed to SAM 2 as box prompt for clean edges. Returns SAM mask, not raw CLIPSeg heatmap.
- **CLIP** (for similar-object): `openai/clip-vit-base-patch32` image encoder. Crop each "everything" mask's bounding region, embed, cosine vs. the clicked-object embedding. Threshold default `0.7` (configurable via request).
- **SAM 2 AutomaticMaskGenerator**: cached per image (computed lazily on first `/sam/similar` call for that image). LRU cache of last 16 images.

### 1.4 Image-embedding cache

`cache.py` keeps an LRU keyed by `image_id`:

```
{
  "image": PIL.Image,
  "sam_embedding": <set on /sam/encode>,
  "everything_masks": list[dict] | None,   # populated on first /sam/similar
  "everything_clip_feats": Tensor | None,
}
```

Eviction: 16 images. When a request arrives with an unknown `image_id` (server restart, eviction), respond `409 Conflict {error: "embedding_lost"}`. The client re-uploads via `/sam/encode` and retries.

### 1.5 Tunnel

`run.sh`:

```bash
#!/usr/bin/env bash
set -e
uvicorn server.main:app --host 0.0.0.0 --port 8000 &
UVICORN_PID=$!
cloudflared tunnel --url http://localhost:8000
kill $UVICORN_PID
```

Output of `cloudflared` includes `https://xxx-yyy-zzz.trycloudflare.com` → paste into the frontend `.env.local` as `VITE_API_BASE`. CORS is wide-open for that origin (FastAPI `CORSMiddleware`, `allow_origins=["*"]`) since this is a research demo.

---

## 2. Frontend ([src/App.tsx](src/App.tsx) refactor)

### 2.1 New file layout

```
src/
  App.tsx                 # ~150 lines: composes panels, owns top-level state
  main.tsx                # unchanged
  index.css               # unchanged
  components/
    EditorCanvas.tsx      # image + visible overlay + pointer events
    Toolbar.tsx           # left panel — brush/eraser/prompt/click/similar
    HistoryPanel.tsx      # right panel — history feed
    TopBar.tsx            # top row — zoom, fit, before/after, export
    PromptInput.tsx       # text-prompt modal/inline
  state/
    useEditor.ts          # zustand-free, plain hook + reducer; mask, undo/redo, mode
  lib/
    api.ts                # fetch wrapper, reads VITE_API_BASE; handles 409 → re-encode
    mask.ts               # decode base64 PNG → ImageData, OR-merge into mask canvas, binarize, export
    image.ts              # SHA-1 of dataURL, resize helpers
  types.ts                # Tool, Mode, HistoryItem, etc.
```

The visual layout, colors, motion animations, lucide icons, and Tailwind classes from the current [App.tsx](src/App.tsx) are preserved — this is a refactor + new behavior, not a redesign.

### 2.2 Mask state model — the core change

Today the canvas holds translucent red strokes. That is a *visualization*, not a mask.

Add a sibling **offscreen mask canvas** at the image's intrinsic size with strict 0/255 pixels. All four modes write into it:

| Mode | Source | Writes to mask canvas |
|---|---|---|
| Brush | pointer strokes | white circle stamped along path |
| Eraser | pointer strokes | black circle stamped along path |
| Click | server `/sam/click` | OR-merge returned binary PNG |
| Prompt | server `/sam/prompt` | OR-merge returned binary PNG |
| Similar | server `/sam/similar` | OR-merge returned binary PNG |

The visible red overlay is *derived* from the mask canvas (re-tinted on every state change) — single source of truth. Undo/redo stack stores PNG dataURLs of the mask canvas, not the visual canvas.

### 2.3 Lifecycle per image

1. User uploads or picks a sample. Client computes SHA-1 of the image bytes (this is just for change detection, not the server's `image_id`).
2. Lazy-encode: on the first SAM-using action, client POSTs to `/sam/encode`, stores `image_id` in editor state. Subsequent SAM calls use that `image_id`.
3. On 409 (`embedding_lost`), client transparently re-encodes and retries.
4. Brush/eraser never hit the server.
5. **Remove Object**: client builds a binary 0/255 PNG from the mask canvas, POSTs `multipart {image, mask}` to `/inpaint`, awaits PNG, sets it as the new image, pushes to history, enables Before/After.

### 2.4 UX details (preserving the current look)

- "Loading model…" toast on first `/sam/encode` (server-side cold start can be ~3–10 s).
- Inline progress for `/sam/click` (~0.2 s), `/sam/prompt` (~0.5 s), `/sam/similar` (~2–5 s on first call per image — then fast).
- Remove Object button is disabled while the mask canvas is empty.
- Replace existing `setTimeout` mock delays with real awaited promises. The animated processing icons stay.
- Error banner at the bottom of the canvas on network/API failure with a "Retry" pill.
- The four mode buttons in the left panel keep their exact current styling; their handlers swap from "cycle pre-baked PNG" to "call API and OR-merge mask".

### 2.5 Environment

`.env.local`:

```
VITE_API_BASE=https://xxx-yyy-zzz.trycloudflare.com
```

`.env.example` updated to document this, replacing the obsolete `GEMINI_API_KEY` (the demo doesn't use Gemini anywhere — verified during repo read).

### 2.6 Drop unused

- `express`, `dotenv`, `@types/express`, `tsx` from [package.json](package.json) (no Node server anymore).
- `mask/*.png` and `result/*.png` and the cycling-index logic.
- `@google/genai` (unused — verify with grep, then remove).

---

## 3. Risks & mitigations

| Risk | Mitigation |
|---|---|
| cloudflared quick tunnel URL changes on restart | Document this; rerun tunnel + update `.env.local` is one-step for demo. Optional: named cloudflared tunnel if user has a Cloudflare account. |
| First SAM-everything call (`/sam/similar`) is slow | Cache result per `image_id`. Show progress. Preload in background after `/sam/encode` if the user enters Similar mode. |
| Server eviction loses embedding mid-session | 409 handling in `api.ts` re-encodes and retries transparently. |
| CORS | FastAPI `CORSMiddleware` `allow_origins=["*"]` — research demo, fine. |
| Mask polarity mismatch | Server normalizes: any non-zero pixel in incoming mask → white; on the way out, masks are strict 0/255. |
| Image too large for 768² PANDORA pipe | PANDORA already handles internal resize and result resize-back; nothing to do client-side. |
| SAM 2 install pain | README pins commit and provides conda env file. If install fails, fallback path documented: SAM 1 (`segment-anything`) — drop-in replace `sam_engine.py`. |

---

## 4. Validation steps (manual, in order)

1. `pip install -r server/requirements.txt && bash server/run.sh` on GPU box → cloudflared prints URL.
2. `curl https://<url>/health` → `{ok: true, sam: true, pandora: true}`.
3. `npm run dev`, set `VITE_API_BASE`. Upload a sample.
4. Brush a region → Remove → real inpainted result returned.
5. Click on the bowl → SAM mask covers it tightly → Remove.
6. Prompt "spoon" → spoon highlighted → Remove.
7. Click one strawberry → "Select Similar" → all strawberries unioned → Remove.
8. Undo/redo across all modes works (mask canvas history).
9. Restart server mid-session → next click is met with 409 → client re-encodes silently and the action succeeds.
10. Before/After, zoom/pan, export still work.

---

## 5. Out of scope

- Auth, rate limiting, persistence — research demo.
- Production deployment of the server (named tunnel, systemd, etc.).
- Exposing the PANDORA advanced parameters in the React UI (border_size, guidance, etc.). Server uses the same defaults as the existing Gradio app. Easy to add later.
- Touching the existing Gradio app — it is mounted under `/gradio` for fallback and otherwise untouched.

---

## 6. File-by-file change inventory

**New**
- `server/main.py`, `server/routes_sam.py`, `server/routes_inpaint.py`, `server/sam_engine.py`, `server/clipseg_engine.py`, `server/similar_engine.py`, `server/schemas.py`, `server/cache.py`, `server/requirements.txt`, `server/run.sh`, `server/README.md`
- `src/components/EditorCanvas.tsx`, `src/components/Toolbar.tsx`, `src/components/HistoryPanel.tsx`, `src/components/TopBar.tsx`, `src/components/PromptInput.tsx`
- `src/state/useEditor.ts`
- `src/lib/api.ts`, `src/lib/mask.ts`, `src/lib/image.ts`
- `src/types.ts`

**Modified**
- [src/App.tsx](src/App.tsx) — slimmed to composition only
- [package.json](package.json) — drop server-side deps + `@google/genai`
- [README.md](README.md) — replace AI-Studio boilerplate with real run instructions
- [.env.example](.env.example) — `VITE_API_BASE` only
- [vite.config.ts](vite.config.ts) — no proxy needed (direct calls to tunnel URL)

**Deleted**
- `mask/` directory (3 PNGs, 1.3 MB)
- `result/` directory (5 PNGs, 2.2 MB)
- `metadata.json` (AI Studio descriptor — no longer relevant; can keep if user prefers)
