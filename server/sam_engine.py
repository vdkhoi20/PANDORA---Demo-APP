"""SAM 2 wrapper with per-image embedding cache.

The predictor's image embedding lives on the GPU. We avoid recomputing it
across requests on the same image by stashing the predictor state inside the
shared ImageCache entry under `sam_embedding`.
"""

from __future__ import annotations

import os
from typing import List, Optional, Tuple

import numpy as np
import torch
from PIL import Image

from .cache import cache, CacheEntry


class SAMEngine:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._predictor = None
        self._auto_mask_generator = None
        self.ready = False

    def load(self) -> None:
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator

        model_cfg = os.environ.get(
            "SAM2_CONFIG",
            "configs/sam2.1/sam2.1_hiera_b+.yaml",
        )
        ckpt = os.environ.get(
            "SAM2_CHECKPOINT",
            "checkpoints/sam2.1_hiera_base_plus.pt",
        )
        sam_model = build_sam2(model_cfg, ckpt, device=self.device)
        self._predictor = SAM2ImagePredictor(sam_model)
        self._auto_mask_generator = SAM2AutomaticMaskGenerator(
            sam_model,
            points_per_side=32,
            pred_iou_thresh=0.86,
            stability_score_thresh=0.92,
            min_mask_region_area=256,
        )
        self.ready = True

    def _ensure_image(self, entry: CacheEntry) -> None:
        if entry.sam_embedding is True:
            return
        arr = np.array(entry.image.convert("RGB"))
        with torch.inference_mode(), torch.autocast(self.device, dtype=torch.bfloat16):
            self._predictor.set_image(arr)
        entry.sam_embedding = True

    def encode(self, image_id: str, image: Image.Image) -> CacheEntry:
        entry = cache.put(image_id, image)
        self._ensure_image(entry)
        return entry

    def predict_from_points(
        self,
        image_id: str,
        points: List[Tuple[float, float]],
        labels: List[int],
    ) -> np.ndarray:
        entry = cache.require(image_id)
        self._predictor.set_image(np.array(entry.image.convert("RGB"))) if entry.sam_embedding is None else None
        if entry.sam_embedding is None:
            self._ensure_image(entry)
        else:
            self._ensure_image(entry)

        coords = np.array(points, dtype=np.float32)
        lbls = np.array(labels, dtype=np.int32)
        with torch.inference_mode(), torch.autocast(self.device, dtype=torch.bfloat16):
            masks, scores, _ = self._predictor.predict(
                point_coords=coords,
                point_labels=lbls,
                multimask_output=True,
            )
        best = int(np.argmax(scores))
        return masks[best].astype(bool)

    def predict_from_box(
        self,
        image_id: str,
        box_xyxy: Tuple[int, int, int, int],
    ) -> np.ndarray:
        entry = cache.require(image_id)
        self._ensure_image(entry)
        with torch.inference_mode(), torch.autocast(self.device, dtype=torch.bfloat16):
            masks, scores, _ = self._predictor.predict(
                box=np.array(box_xyxy, dtype=np.float32),
                multimask_output=False,
            )
        return masks[0].astype(bool)

    def generate_everything(self, image_id: str) -> List[dict]:
        entry = cache.require(image_id)
        if entry.everything_masks is not None:
            return entry.everything_masks
        arr = np.array(entry.image.convert("RGB"))
        with torch.inference_mode(), torch.autocast(self.device, dtype=torch.bfloat16):
            masks = self._auto_mask_generator.generate(arr)
        entry.everything_masks = masks
        return masks


sam_engine = SAMEngine()
