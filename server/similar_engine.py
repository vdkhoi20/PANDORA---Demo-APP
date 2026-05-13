"""Similar-object detection.

1. Click -> SAM mask (reference object).
2. SAM AutomaticMaskGenerator over the whole image (cached per image_id).
3. CLIP image embedding for the bounding-region crop of each candidate mask.
4. Cosine similarity against the reference embedding -> threshold -> union.
"""

from __future__ import annotations

from typing import List, Tuple

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from .cache import cache, CacheEntry
from .sam_engine import sam_engine


class SimilarEngine:
    def __init__(self, model_id: str = "openai/clip-vit-base-patch32"):
        self.model_id = model_id
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._processor = None
        self._model = None

    def load(self) -> None:
        from transformers import CLIPProcessor, CLIPModel

        self._processor = CLIPProcessor.from_pretrained(self.model_id)
        self._model = CLIPModel.from_pretrained(self.model_id).to(self.device)
        self._model.eval()

    def _crop_for_mask(self, image: Image.Image, seg: np.ndarray) -> Image.Image:
        ys, xs = np.where(seg)
        if len(xs) == 0:
            return image
        x0, y0 = int(xs.min()), int(ys.min())
        x1, y1 = int(xs.max()), int(ys.max())
        pad = max(4, int(0.05 * max(x1 - x0, y1 - y0)))
        x0 = max(0, x0 - pad)
        y0 = max(0, y0 - pad)
        x1 = min(image.width - 1, x1 + pad)
        y1 = min(image.height - 1, y1 + pad)
        return image.crop((x0, y0, x1 + 1, y1 + 1))

    def _embed(self, crops: List[Image.Image]) -> torch.Tensor:
        if not crops:
            return torch.zeros((0, 512), device=self.device)
        inputs = self._processor(images=crops, return_tensors="pt").to(self.device)
        with torch.inference_mode():
            feats = self._model.get_image_features(**inputs)
        feats = F.normalize(feats, dim=-1)
        return feats

    def _ensure_everything_feats(self, entry: CacheEntry) -> None:
        if entry.everything_clip_feats is not None and entry.everything_masks is not None:
            return
        masks = sam_engine.generate_everything(_image_id_for_entry(entry))
        crops = [self._crop_for_mask(entry.image, m["segmentation"]) for m in masks]
        feats = self._embed(crops)
        entry.everything_clip_feats = feats

    def find(
        self,
        image_id: str,
        points: List[Tuple[float, float]],
        threshold: float = 0.7,
    ):
        entry = cache.require(image_id)
        labels = [1] * len(points)
        ref_seg = sam_engine.predict_from_points(image_id, points, labels)
        ref_crop = self._crop_for_mask(entry.image, ref_seg)
        ref_feat = self._embed([ref_crop])  # (1, D)

        # populate everything feats lazily
        if entry.everything_masks is None or entry.everything_clip_feats is None:
            masks = sam_engine.generate_everything(image_id)
            crops = [self._crop_for_mask(entry.image, m["segmentation"]) for m in masks]
            entry.everything_clip_feats = self._embed(crops)

        feats = entry.everything_clip_feats
        if feats.shape[0] == 0:
            empty = np.zeros(
                (entry.image.height, entry.image.width), dtype=bool
            )
            return empty | ref_seg, 1

        sims = (feats @ ref_feat.T).squeeze(-1).cpu().numpy()
        keep = np.where(sims >= threshold)[0]

        union = ref_seg.copy()
        for idx in keep:
            union |= entry.everything_masks[int(idx)]["segmentation"]
        return union, int(len(keep) + 1)


def _image_id_for_entry(entry: CacheEntry) -> str:
    # Walk the cache to recover the id (rare path; only used inside ensure_everything_feats).
    for k, v in cache._items.items():  # type: ignore[attr-defined]
        if v is entry:
            return k
    raise KeyError("entry not found in cache")


similar_engine = SimilarEngine()
