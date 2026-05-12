"""LRU cache keyed by image_id (sha-1 of image bytes).

Holds the PIL image, the SAM image embedding (set lazily by the SAM engine),
the SAM "everything" masks (set lazily by the similar engine), and the per-mask
CLIP feature matrix used for similar-object cosine matching.
"""

from __future__ import annotations

import hashlib
import threading
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Optional

from PIL import Image


@dataclass
class CacheEntry:
    image: Image.Image
    sam_embedding: Optional[Any] = None
    everything_masks: Optional[list] = None
    everything_clip_feats: Optional[Any] = None
    extras: dict = field(default_factory=dict)


class ImageCache:
    def __init__(self, max_items: int = 16):
        self._max = max_items
        self._items: "OrderedDict[str, CacheEntry]" = OrderedDict()
        self._lock = threading.Lock()

    @staticmethod
    def hash_bytes(data: bytes) -> str:
        return hashlib.sha1(data).hexdigest()[:16]

    def put(self, image_id: str, image: Image.Image) -> CacheEntry:
        with self._lock:
            entry = self._items.get(image_id)
            if entry is None:
                entry = CacheEntry(image=image)
                self._items[image_id] = entry
                while len(self._items) > self._max:
                    self._items.popitem(last=False)
            else:
                self._items.move_to_end(image_id)
            return entry

    def get(self, image_id: str) -> Optional[CacheEntry]:
        with self._lock:
            entry = self._items.get(image_id)
            if entry is not None:
                self._items.move_to_end(image_id)
            return entry

    def require(self, image_id: str) -> CacheEntry:
        entry = self.get(image_id)
        if entry is None:
            from fastapi import HTTPException

            raise HTTPException(
                status_code=409,
                detail={"error": "embedding_lost", "image_id": image_id},
            )
        return entry


cache = ImageCache(max_items=16)
