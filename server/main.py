"""FastAPI entry point.

Run on the GPU box (next to pandora-removal_demo/) and tunnel with cloudflared:

    uvicorn server.main:app --host 0.0.0.0 --port 8000 &
    cloudflared tunnel --url http://localhost:8000

Set the printed `https://*.trycloudflare.com` URL as VITE_API_BASE in the
frontend .env.local.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes_inpaint import router as inpaint_router
from .routes_sam import router as sam_router
from .schemas import HealthResponse

app = FastAPI(title="Clutter Erase Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sam_router)
app.include_router(inpaint_router)


@app.on_event("startup")
async def _startup() -> None:
    from .clipseg_engine import clipseg_engine
    from .sam_engine import sam_engine
    from .similar_engine import similar_engine

    print("[startup] loading SAM 2 ...")
    sam_engine.load()
    print("[startup] loading CLIPSeg ...")
    clipseg_engine.load()
    print("[startup] loading CLIP ...")
    similar_engine.load()
    print("[startup] all models ready.")

    if os.environ.get("PRELOAD_PANDORA", "1") == "1":
        try:
            from .routes_inpaint import _ensure_model

            print("[startup] loading PANDORA ...")
            _ensure_model()
            print("[startup] PANDORA ready.")
        except Exception as e:
            print(f"[startup] PANDORA preload skipped: {e}")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    from .sam_engine import sam_engine
    from .routes_inpaint import _model as pandora_model

    return HealthResponse(
        ok=True,
        sam=bool(sam_engine.ready),
        pandora=pandora_model is not None,
    )


# Optional: mount the existing Gradio app at /gradio so it stays accessible.
def _try_mount_gradio() -> None:
    try:
        import gradio as gr  # noqa: F401
        from app import demo  # type: ignore
    except Exception:
        return
    try:
        import gradio as gr

        global app
        app = gr.mount_gradio_app(app, demo, path="/gradio")
    except Exception as e:
        print(f"[startup] could not mount /gradio: {e}")


_try_mount_gradio()
