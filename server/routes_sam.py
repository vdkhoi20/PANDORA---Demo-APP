"""HTTP routes for the four SAM-backed endpoints."""

from __future__ import annotations

import base64
import io

import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image

from .cache import cache
from .clipseg_engine import clipseg_engine
from .schemas import (
    ClickRequest,
    EncodeResponse,
    MaskResponse,
    PromptMaskResponse,
    PromptRequest,
    SimilarMaskResponse,
    SimilarRequest,
)
from .sam_engine import sam_engine
from .similar_engine import similar_engine

router = APIRouter(prefix="/sam", tags=["sam"])


def _mask_to_b64(mask_bool: np.ndarray) -> str:
    arr = (mask_bool.astype(np.uint8)) * 255
    img = Image.fromarray(arr, mode="L")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


@router.post("/encode", response_model=EncodeResponse)
async def encode(image: UploadFile = File(...)) -> EncodeResponse:
    raw = await image.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty_image")
    image_id = cache.hash_bytes(raw)
    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    sam_engine.encode(image_id, pil)
    return EncodeResponse(image_id=image_id, width=pil.width, height=pil.height)


@router.post("/click", response_model=MaskResponse)
async def click(req: ClickRequest) -> MaskResponse:
    if len(req.points) != len(req.labels):
        raise HTTPException(
            status_code=400, detail="points_and_labels_length_mismatch"
        )
    mask = sam_engine.predict_from_points(req.image_id, req.points, req.labels)
    return MaskResponse(mask_png_b64=_mask_to_b64(mask))


@router.post("/prompt", response_model=PromptMaskResponse)
async def prompt(req: PromptRequest) -> PromptMaskResponse:
    mask, bbox_xywh = clipseg_engine.segment(req.image_id, req.text)
    return PromptMaskResponse(mask_png_b64=_mask_to_b64(mask), bbox=bbox_xywh)


@router.post("/similar", response_model=SimilarMaskResponse)
async def similar(req: SimilarRequest) -> SimilarMaskResponse:
    mask, count = similar_engine.find(req.image_id, req.points, req.threshold)
    return SimilarMaskResponse(mask_png_b64=_mask_to_b64(mask), count=count)
