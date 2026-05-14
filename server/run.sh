#!/usr/bin/env bash
# Start the Clutter Erase FastAPI server on $PORT (auto-picked if unset).
#
# Exposure is the caller's responsibility. The typical flow is:
#   - server/run-all.sh   -> named Cloudflare tunnel (pandora.nguyenvanloc.com)
#   - manual cloudflared --url http://localhost:$PORT for a one-off quick tunnel
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

# Source server/.env if present, so site-specific overrides (paths, ports,
# tokens) can be kept out of git. See server/.env.example.
if [[ -f "$HERE/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$HERE/.env"
  set +a
fi

# stabilityai/stable-diffusion-2-1 was deprecated; sd2-community/* is a
# verbatim mirror. Default to it so /inpaint works without extra setup.
export PANDORA_MODEL_PATH="${PANDORA_MODEL_PATH:-sd2-community/stable-diffusion-2-1}"

# Resolve PANDORA_DEMO_DIR: honor the env var if set, otherwise search a few
# common locations. First existing path wins.
if [[ -z "${PANDORA_DEMO_DIR:-}" ]]; then
  for candidate in \
    "$REPO_ROOT/pandora-removal_demo" \
    "$REPO_ROOT/../Object_Removal_benchmark_v21/pandora-removal_demo" \
    "$HOME/Object_Removal_benchmark_v21/pandora-removal_demo" \
    "/raid/$USER/nvloc/Object_Removal_benchmark_v21/pandora-removal_demo" \
    "/raid/hvtham/nvloc/Object_Removal_benchmark_v21/pandora-removal_demo" \
    "/raid/ltnghia01/vdkhoi/Object_Removal_benchmark_v21/pandora-removal_demo" \
  ; do
    if [[ -d "$candidate" ]]; then
      PANDORA_DEMO_DIR="$candidate"
      break
    fi
  done
fi

if [[ -z "${PANDORA_DEMO_DIR:-}" || ! -d "$PANDORA_DEMO_DIR" ]]; then
  echo "[run.sh] PANDORA_DEMO_DIR not found (searched defaults and \$PANDORA_DEMO_DIR)."
  echo "[run.sh] Set PANDORA_DEMO_DIR=/path/to/pandora-removal_demo and re-run,"
  echo "[run.sh] or drop one into server/.env (see server/.env.example)."
  exit 1
fi

export PYTHONPATH="$PANDORA_DEMO_DIR:${PYTHONPATH:-}"

# Pick a free port unless one is explicitly set (this box is shared, so the
# default 8000 collides regularly).
find_free_port() {
  python3 - <<'PY' 2>/dev/null
import socket
s = socket.socket()
s.bind(('', 0))
print(s.getsockname()[1])
s.close()
PY
}

if [[ -z "${PORT:-}" ]]; then
  PORT="$(find_free_port || true)"
  if [[ -z "$PORT" ]]; then
    PORT=8765
  fi
fi

echo "[run.sh] PANDORA_DEMO_DIR=$PANDORA_DEMO_DIR"
echo "[run.sh] PANDORA_MODEL_PATH=$PANDORA_MODEL_PATH"
echo "[run.sh] starting uvicorn on port $PORT"

uvicorn server.main:app --host 0.0.0.0 --port "$PORT" --workers 1 &
UVICORN_PID=$!

cleanup() {
  kill "$UVICORN_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[run.sh] server up at http://localhost:$PORT"
wait "$UVICORN_PID"
