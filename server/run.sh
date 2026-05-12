#!/usr/bin/env bash
# Start the Clutter Erase server and expose it via a free cloudflared quick tunnel.
#
# Prereqs (one-time):
#   pip install -r server/requirements.txt
#   # SAM 2 weights
#   mkdir -p checkpoints && cd checkpoints && \
#     wget https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_base_plus.pt && cd ..
#   # cloudflared (Linux):
#   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
#
# Layout assumption:
#   <repo>/
#     server/                    <-- this directory
#     pandora-removal_demo/      <-- existing PANDORA Gradio demo
#       src/pandora_removal/...
#       PANDORACode/...
#       app.py
#
# We add pandora-removal_demo to PYTHONPATH so `from src.pandora_removal import ...`
# and `from PANDORACode.* import ...` resolve, exactly as the existing app.py expects.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"

# Allow override; default assumes pandora-removal_demo is a sibling of the server dir's parent.
PANDORA_DEMO_DIR="${PANDORA_DEMO_DIR:-$REPO_ROOT/pandora-removal_demo}"

if [[ ! -d "$PANDORA_DEMO_DIR" ]]; then
  echo "[run.sh] PANDORA_DEMO_DIR not found: $PANDORA_DEMO_DIR"
  echo "[run.sh] Set PANDORA_DEMO_DIR=/path/to/pandora-removal_demo and re-run."
  exit 1
fi

export PYTHONPATH="$PANDORA_DEMO_DIR:${PYTHONPATH:-}"

PORT="${PORT:-8000}"

uvicorn server.main:app --host 0.0.0.0 --port "$PORT" --workers 1 &
UVICORN_PID=$!

cleanup() {
  kill "$UVICORN_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 2

if command -v cloudflared >/dev/null 2>&1; then
  echo "[run.sh] starting cloudflared quick tunnel -> http://localhost:$PORT"
  cloudflared tunnel --url "http://localhost:$PORT"
else
  echo "[run.sh] cloudflared not installed; server is up at http://localhost:$PORT"
  echo "[run.sh] either install cloudflared, or use ngrok: ngrok http $PORT"
  wait "$UVICORN_PID"
fi
