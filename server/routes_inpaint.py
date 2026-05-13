"""PANDORA inpaint endpoint.

Mirrors the contract used by `pandora-removal_demo/app.py`:
    PandoraRemoval.remove_object(image: PIL, mask: PIL, border_size, guidance_scale,
                                 percentile, step_query, num_steps) -> PIL
The result is resized back to the input image's original size before return.
"""

from __future__ import annotations

import io
import os
from typing import Optional

import torch
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image

router = APIRouter(tags=["inpaint"])

_model = None


def _ensure_model():
    global _model
    if _model is not None:
        return _model
    try:
        from src.pandora_removal import PandoraRemoval, PandoraConfig  # type: ignore
    except Exception as e:  # pragma: no cover - import-time path issue
        raise HTTPException(
            status_code=500,
            detail={
                "error": "pandora_import_failed",
                "hint": (
                    "Make sure server/ is run from the directory that contains "
                    "pandora-removal_demo/src/, or set PYTHONPATH appropriately."
                ),
                "exception": str(e),
            },
        )
    cfg_kwargs = {}
    # Override PandoraConfig.model_path with a local checkpoint or alternate HF id
    # if PANDORA_MODEL_PATH is set. Useful when the default
    # stabilityai/stable-diffusion-2-1 is gated/blocked on the GPU box.
    model_path_override = os.environ.get("PANDORA_MODEL_PATH")
    if model_path_override:
        cfg_kwargs["model_path"] = model_path_override
        print(f"[inpaint] PANDORA_MODEL_PATH override -> {model_path_override}")
    cfg = PandoraConfig(**cfg_kwargs)
    m = PandoraRemoval(config=cfg)
    m.load_model()
    _model = m
    return _model


@router.post("/inpaint")
async def inpaint(
    image: UploadFile = File(...),
    mask: UploadFile = File(...),
    border_size: int = Form(1),
    guidance_scale: float = Form(1.3),
    percentile: float = Form(95.0),
    step_query: int = Form(45),
    num_steps: int = Form(50),
    seed: int = Form(-1),
):
    img_bytes = await image.read()
    msk_bytes = await mask.read()
    if not img_bytes or not msk_bytes:
        raise HTTPException(status_code=400, detail="missing_image_or_mask")

    src = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    msk = Image.open(io.BytesIO(msk_bytes)).convert("L")

    if msk.size != src.size:
        msk = msk.resize(src.size, resample=Image.NEAREST)

    model = _ensure_model()

    if seed != -1:
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed(seed)

    with torch.inference_mode():
        result: Image.Image = model.remove_object(
            image=src,
            mask=msk,
            border_size=border_size,
            guidance_scale=guidance_scale,
            percentile=percentile,
            step_query=step_query,
            num_steps=num_steps,
        )

    if result.size != src.size:
        result = result.resize(src.size, resample=Image.BICUBIC)

    buf = io.BytesIO()
    result.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")
