# Clutter Erase — Inference Server

FastAPI service that exposes SAM 2 (mask generation) and PANDORA (object removal) over HTTP, tunneled with cloudflared. The React frontend in this repo calls these endpoints.

## Layout assumed on the GPU box

```
<workdir>/
  server/                     <-- this directory
  pandora-removal_demo/       <-- existing PANDORA Gradio demo from Object_Removal_benchmark_v21
    app.py
    src/pandora_removal/
    PANDORACode/
    requirements.txt
  checkpoints/
    sam2.1_hiera_base_plus.pt
```

If `pandora-removal_demo/` lives elsewhere, set `PANDORA_DEMO_DIR=/abs/path/to/pandora-removal_demo` before running `run.sh`.

## One-time setup

```bash
# Python deps for this server (in the same env that runs PANDORA)
pip install -r server/requirements.txt

# SAM 2 weights (~360 MB)
mkdir -p checkpoints
wget -O checkpoints/sam2.1_hiera_base_plus.pt \
  https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_base_plus.pt

# cloudflared (Linux x86_64)
sudo curl -L \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

If you prefer ngrok: `pip install pyngrok` then `ngrok http 8000` instead of cloudflared.

## Run

```bash
bash server/run.sh
```

This will:
1. Start `uvicorn server.main:app` on port 8000.
2. Eagerly load SAM 2, CLIPSeg, CLIP, and PANDORA at startup (~10–30 s).
3. Launch a cloudflared quick tunnel and print a URL like `https://small-words-1234.trycloudflare.com`.

Paste that URL into the frontend's `.env.local`:

```
VITE_API_BASE=https://small-words-1234.trycloudflare.com
```

## Endpoints

All payloads use base64 PNGs for masks; binary masks are strict 0/255 grayscale.

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/sam/encode` | multipart `image` | `{image_id, width, height}` |
| `POST` | `/sam/click` | `{image_id, points: [[x,y]], labels: [0|1]}` | `{mask_png_b64}` |
| `POST` | `/sam/prompt` | `{image_id, text}` | `{mask_png_b64, bbox: [x,y,w,h]}` |
| `POST` | `/sam/similar` | `{image_id, points: [[x,y]], threshold?}` | `{mask_png_b64, count}` |
| `POST` | `/inpaint` | multipart `image, mask`; form `border_size,guidance_scale,percentile,step_query,num_steps,seed` | PNG stream |
| `GET`  | `/health` | — | `{ok, sam, pandora}` |
| `*`    | `/gradio/*` | — | existing PANDORA Gradio UI (if importable) |

`/sam/click`, `/sam/prompt`, `/sam/similar` return **409 `{error: "embedding_lost"}`** if the server has evicted the image (LRU max=16) or restarted. The frontend handles this transparently by re-calling `/sam/encode`.

## Env vars

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8000` | uvicorn port |
| `PANDORA_DEMO_DIR` | `<repo>/../pandora-removal_demo` | where to find PANDORA's `src/` and `PANDORACode/` |
| `SAM2_CONFIG` | `configs/sam2.1/sam2.1_hiera_b+.yaml` | SAM 2 config |
| `SAM2_CHECKPOINT` | `checkpoints/sam2.1_hiera_base_plus.pt` | SAM 2 weights |
| `PRELOAD_PANDORA` | `1` | load PANDORA at startup vs. on first inpaint call |
