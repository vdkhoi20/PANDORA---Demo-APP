<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Clutter Erase — PANDORA Demo App

Interactive web demo for the paper **"Zero-Shot Mass-Similar and Multi-Object Removal in Single Pass"**. The frontend is a React/Vite static site; the inference backend is a FastAPI service that hosts SAM 2 (for mask generation) and PANDORA (for object removal), exposed to the internet via a tunnel.

```
React / Vite (static)  ──HTTPS──►  FastAPI on GPU box  ──►  SAM 2 + PANDORA
```

---

## One-time setup (GPU box)

### Python deps & model weights

```bash
pip install -r server/requirements.txt

# SAM 2 weights (~360 MB)
mkdir -p checkpoints
wget -O checkpoints/sam2.1_hiera_base_plus.pt \
  https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_base_plus.pt
```

The server expects a `pandora-removal_demo/` directory from `Object_Removal_benchmark_v21`. By default it is searched at `<repo>/../pandora-removal_demo`. Override with:

```bash
export PANDORA_DEMO_DIR=/path/to/pandora-removal_demo
```

or put it in `server/.env` (see [server/.env.example](server/.env.example)).

### Node.js (required for both options)

Node.js 18+ is required by Vite 6. If you are inside a conda environment:

```bash
conda install -c conda-forge 'nodejs>=20'
```

Or use nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
```

---

## Option 1 — Without your own domain (Cloudflare quick tunnel or ngrok)

Use this when you just want a temporary public URL for a demo. No DNS configuration needed.

### Step 1 — Start the backend

```bash
bash server/run.sh
```

This starts `uvicorn` on a free port. It does **not** open a tunnel — you do that separately.

### Step 2 — Open a tunnel

**Option A: Cloudflare quick tunnel** (no account required)

Install `cloudflared` once:

```bash
# Linux x86_64
sudo curl -L \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

Then (replace `PORT` with the port printed by `run.sh`):

```bash
cloudflared tunnel --url http://localhost:PORT
```

The terminal prints a URL like `https://small-words-1234.trycloudflare.com`. Copy it.

**Option B: ngrok**

```bash
pip install pyngrok   # one-time
ngrok http PORT
```

Copy the `https://...ngrok-free.app` URL printed by ngrok.

### Step 3 — Configure the frontend

```bash
# (on the machine running the browser — can be your laptop)
npm install
cp .env.example .env.local
# Edit .env.local and set VITE_API_BASE to the tunnel URL from Step 2:
# VITE_API_BASE=https://small-words-1234.trycloudflare.com
npm run dev
```

The app is available at http://localhost:3000.

> **Note:** The quick-tunnel URL changes every time you restart `cloudflared`. Update `.env.local` and restart `npm run dev` when that happens.

---

## Option 2 — With your own domain (named Cloudflare tunnel)

Use this for a stable, permanent URL. The script `server/run-all.sh` starts the backend, the frontend, and the named tunnel in one command — no `.env.local` editing needed.

### Routing assumed

| Subdomain | Service |
|---|---|
| `pandora.yourdomain.com` | FastAPI backend |
| `clutter-erase.yourdomain.com` | Vite frontend |

### One-time tunnel setup

Install `cloudflared` (see Option 1 above), then:

```bash
# Log in and create a named tunnel
cloudflared tunnel login
cloudflared tunnel create pandora

# Route your subdomains through the tunnel
cloudflared tunnel route dns pandora pandora.yourdomain.com
cloudflared tunnel route dns pandora clutter-erase.yourdomain.com
```

Note the tunnel UUID printed by `cloudflared tunnel create`. You will need it below.

### Configure the script

Create `server/.env` (git-ignored) on the GPU box:

```bash
cp server/.env.example server/.env
```

Then set the following variables (you can also export them in your shell instead):

```bash
# Tunnel name and UUID from `cloudflared tunnel create`
TUNNEL_NAME=pandora
TUNNEL_UUID=<your-tunnel-uuid>

# Your hostnames
BE_HOSTNAME=pandora.yourdomain.com
FE_HOSTNAME=clutter-erase.yourdomain.com

# Path to pandora-removal_demo if not in the default location
# PANDORA_DEMO_DIR=/path/to/pandora-removal_demo
```

### Run everything

```bash
bash server/run-all.sh
```

This single command:

1. Picks free ports for the backend and frontend.
2. Starts `uvicorn` (FastAPI) on the backend port.
3. Starts `vite` (React) on the frontend port, with `VITE_API_BASE` set automatically to `https://$BE_HOSTNAME`.
4. Writes `~/.cloudflared/config.yml` and runs the named tunnel.

Both subdomains are live immediately — no `.env.local` or browser-side configuration required.

---

## How it works

| Selection mode | Where it runs | What it does |
|---|---|---|
| Brush / Eraser | client only | Paints into an offscreen 0/255 mask canvas. |
| Click to Auto Mask | `/sam/click` | Single-point prompt to SAM 2; returns the best mask. |
| Select via Prompt | `/sam/prompt` | CLIPSeg → bbox → SAM 2 box-prompted refinement. |
| Select Similar Objects | `/sam/similar` | SAM 2 click mask → CLIP embedding → cosine match against SAM 2 "everything" masks → union. |
| Remove Object | `/inpaint` | Sends `(image, binary mask)` to PANDORA. |

All four selection modes write into the same single source of truth (the mask canvas). "Remove Object" sends a strict 0/255 PNG of that canvas to PANDORA, which returns the inpainted PNG.

---

## Project layout

```
src/
  App.tsx                composition only
  components/            EditorCanvas, Toolbar, TopBar, HistoryPanel
  hooks/useMaskActions   click / prompt / similar / remove
  lib/                   api, mask, image
  state/useEditor.tsx    EditorProvider, useEditor (context + reducer)
  types.ts
server/                  FastAPI + SAM 2 + PANDORA
  run.sh                 start backend only (tunnel is separate)
  run-all.sh             start BE + FE + named Cloudflare tunnel together
  README.md              full API docs and env-var reference
PLAN.md                  the implementation plan this codebase follows
```
