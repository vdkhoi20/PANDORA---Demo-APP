#!/usr/bin/env bash
# Bring up BE (uvicorn), FE (vite), and the named Cloudflare tunnel together.
#
# Routing (configured once with `cloudflared tunnel route dns`):
#   pandora.nguyenvanloc.com         -> BE  (FastAPI)
#   cluster-erase.nguyenvanloc.com   -> FE  (Vite dev server)
#
# Because port 3000 is usually taken on this shared box, the FE and BE both
# bind to free ports picked at startup. We render ~/.cloudflared/config.yml
# with those ports each run, then exec cloudflared.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"

TUNNEL_NAME="${TUNNEL_NAME:-pandora}"
TUNNEL_UUID="${TUNNEL_UUID:-ac55fc0d-0ccf-4743-a065-ac2b1ac4b0e2}"
BE_HOSTNAME="${BE_HOSTNAME:-pandora.nguyenvanloc.com}"
FE_HOSTNAME="${FE_HOSTNAME:-cluster-erase.nguyenvanloc.com}"
CF_DIR="${CF_DIR:-$HOME/.cloudflared}"
CF_CONFIG="$CF_DIR/config.yml"
CF_CREDS="$CF_DIR/$TUNNEL_UUID.json"

if [[ ! -f "$CF_CREDS" ]]; then
  echo "[run-all] tunnel credentials missing: $CF_CREDS"
  echo "[run-all] run: cloudflared tunnel login && cloudflared tunnel create $TUNNEL_NAME"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if (( NODE_MAJOR < 18 )); then
  echo "[run-all] Node $(node -v 2>/dev/null || echo 'not found') is too old; Vite 6 needs >= 18."
  echo "[run-all] Inside the conda env: conda install -c conda-forge 'nodejs>=20'"
  echo "[run-all] Otherwise:           curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && nvm install 20"
  exit 1
fi

find_free_port() {
  python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("", 0))
print(s.getsockname()[1])
s.close()
PY
}

BE_PORT="${BE_PORT:-$(find_free_port)}"
FE_PORT="${FE_PORT:-$(find_free_port)}"

VITE_BIN="$REPO_ROOT/node_modules/.bin/vite"
if [[ ! -x "$VITE_BIN" ]]; then
  echo "[run-all] node_modules missing -> running npm install (one-time)"
  (cd "$REPO_ROOT" && npm install)
fi

cat > "$CF_CONFIG" <<EOF
tunnel: $TUNNEL_UUID
credentials-file: $CF_CREDS
ingress:
  - hostname: $BE_HOSTNAME
    service: http://localhost:$BE_PORT
  - hostname: $FE_HOSTNAME
    service: http://localhost:$FE_PORT
  - service: http_status:404
EOF

echo "[run-all] BE  :$BE_PORT  -> https://$BE_HOSTNAME"
echo "[run-all] FE  :$FE_PORT  -> https://$FE_HOSTNAME"

PORT="$BE_PORT" bash "$HERE/run.sh" &
BE_PID=$!

# Inject the public BE URL so the FE doesn't depend on a .env.local file
# being copied onto the box. Vite picks up VITE_* env vars at startup.
export VITE_API_BASE="https://$BE_HOSTNAME"
echo "[run-all] VITE_API_BASE=$VITE_API_BASE"

(cd "$REPO_ROOT" && "$VITE_BIN" --port="$FE_PORT" --strictPort --host=0.0.0.0) &
FE_PID=$!

cleanup() {
  kill "$BE_PID" "$FE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Give uvicorn a moment to bind before cloudflared starts probing.
sleep 3

CLOUDFLARED_PROTOCOL="${CLOUDFLARED_PROTOCOL:-http2}"
CLOUDFLARED_EDGE_IP_VERSION="${CLOUDFLARED_EDGE_IP_VERSION:-4}"
exec cloudflared tunnel \
  --config "$CF_CONFIG" \
  --protocol "$CLOUDFLARED_PROTOCOL" \
  --edge-ip-version "$CLOUDFLARED_EDGE_IP_VERSION" \
  run "$TUNNEL_NAME"
