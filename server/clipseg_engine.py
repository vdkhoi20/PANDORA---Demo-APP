"""Text -> bounding box via CLIPSeg, then SAM 2 refines to a clean mask.

Returns the SAM mask plus the bbox so the client can show it if desired.
"""

from __future__ import annotations

from typing import Tuple

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from .cache import cache
from .sam_engine import sam_engine


class CLIPSegEngine:
    def __init__(self, model_id: str = "CIDAS/clipseg-rd64-refined"):
        self.model_id = model_id
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._processor = None
        self._model = None

    def load(self) -> None:
        from transformers import CLIPSegProcessor, CLIPSegForImageSegmentation

        self._processor = CLIPSegProcessor.from_pretrained(self.model_id)
        self._model = CLIPSegForImageSegmentation.from_pretrained(self.model_id).to(
            self.device
        )
        self._model.eval()

    def _heatmap(self, image: Image.Image, text: str) -> np.ndarray:
        inputs = self._processor(
            text=[text], images=[image], padding=True, return_tensors="pt"
        ).to(self.device)
        with torch.inference_mode():
            outputs = self._model(**inputs)
        logits = outputs.logits  # (1, H', W') for a single text
        if logits.ndim == 3:
            logits = logits.unsqueeze(1)
        prob = torch.sigmoid(logits)
        prob = F.interpolate(
            prob, size=image.size[::-1], mode="bilinear", align_corners=False
        )
        return prob[0, 0].cpu().numpy()

    @staticmethod
    def _heatmap_to_bbox(
        heatmap: np.ndarray, threshold: float = 0.4
    ) -> Tuple[int, int, int, int]:
        binary = heatmap >= max(threshold, float(heatmap.mean() + heatmap.std()))
        if not binary.any():
            binary = heatmap >= heatmap.mean()
        ys, xs = np.where(binary)
        if len(xs) == 0:
            h, w = heatmap.shape
            return 0, 0, w - 1, h - 1
        x0, y0 = int(xs.min()), int(ys.min())
        x1, y1 = int(xs.max()), int(ys.max())
        return x0, y0, x1, y1

    def segment(self, image_id: str, text: str):
        entry = cache.require(image_id)
        heatmap = self._heatmap(entry.image, text)
        x0, y0, x1, y1 = self._heatmap_to_bbox(heatmap)
        mask = sam_engine.predict_from_box(image_id, (x0, y0, x1, y1))
        bbox_xywh = (x0, y0, x1 - x0, y1 - y0)
        return mask, bbox_xywh


clipseg_engine = CLIPSegEngine()
