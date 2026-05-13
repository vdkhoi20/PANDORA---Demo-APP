from typing import List, Optional, Tuple
from pydantic import BaseModel, Field


class EncodeResponse(BaseModel):
    image_id: str
    width: int
    height: int


class ClickRequest(BaseModel):
    image_id: str
    points: List[Tuple[float, float]] = Field(..., min_length=1)
    labels: List[int] = Field(..., min_length=1)


class PromptRequest(BaseModel):
    image_id: str
    text: str = Field(..., min_length=1)


class SimilarRequest(BaseModel):
    image_id: str
    points: List[Tuple[float, float]] = Field(..., min_length=1)
    threshold: float = 0.7


class MaskResponse(BaseModel):
    mask_png_b64: str


class PromptMaskResponse(MaskResponse):
    bbox: Tuple[int, int, int, int]


class SimilarMaskResponse(MaskResponse):
    count: int


class HealthResponse(BaseModel):
    ok: bool
    sam: bool
    pandora: bool


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
