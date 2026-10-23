"""
ShelfSense AI — Few-Shot Product Enrollment & Continual Self-Training Engine
============================================================================
Implements the core technical novelty described in the ShelfSense CVPR paper:
  1. Few-Shot Enrollment: Introduce new retail products using only 15–20 images
     without full YOLO retraining.
  2. Prototype Metric Learning: Deep visual feature extraction (MobileNetV3-Small)
     producing normalized unit-sphere class prototypes in R^128.
  3. Real-Time Metric Matching: Cosine similarity comparison against candidate
     shelf object crops.
  4. Continual Online Self-Training: Whenever the enrolled object is detected on
     the shelf with high confidence, the system:
       - Dynamically adapts the prototype via momentum exponential moving average (EMA)
       - Adds high-confidence crops to an Online Memory Replay Buffer
       - Runs incremental contrastive gradient updates to prevent catastrophic forgetting
         and continually sharpen discriminative representations under variable lighting.
"""

from __future__ import annotations

import copy
import datetime
import io
import json
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models
import torchvision.transforms as T
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ENROLLED_DIR = ROOT / "datasets" / "enrolled_products"
PROTOTYPES_PT = ROOT / "models" / "few_shot_prototypes.pt"
PROTOTYPES_JSON = ROOT / "models" / "few_shot_prototypes.json"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Standard ImageNet preprocessing transform
TRANSFORM = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# Heavy augmentation for expanding 15-20 enrollment frames into diverse exemplars
AUGMENTATION_TRANSFORM = T.Compose([
    T.Resize((224, 224)),
    T.RandomHorizontalFlip(p=0.5),
    T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    T.RandomRotation(degrees=10),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


class MetricProjectionHead(nn.Module):
    """Projects 576-dim MobileNet features into a normalized 128-dim metric space."""

    def __init__(self, in_features: int = 576, out_features: int = 128) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.LayerNorm(256),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(256, out_features),
            nn.LayerNorm(out_features),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = self.net(x)
        return F.normalize(h, p=2, dim=1)


class ShelfSenseFewShotContinualEngine:
    """
    Manages few-shot enrollment, prototype registry, real-time matching,
    and online continual self-training.
    """

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.device = DEVICE

        # 1. Feature Backbone (MobileNetV3-Small)
        self.backbone = models.mobilenet_v3_small(weights="DEFAULT")
        self.backbone.classifier = nn.Identity()
        for param in self.backbone.parameters():
            param.requires_grad = False
        self.backbone.to(self.device)
        self.backbone.eval()

        # 2. Metric Projection Head
        self.projection_head = MetricProjectionHead(in_features=576, out_features=128).to(self.device)
        self.optimizer = torch.optim.AdamW(self.projection_head.parameters(), lr=4e-4, weight_decay=1e-4)

        # 3. Product Prototype Registry
        # Stores: name -> {
        #   prototype: Tensor,
        #   initial_prototype: Tensor,
        #   threshold: float,
        #   category: str,
        #   zone: str,
        #   reorder_threshold: int,
        #   total_observations: int,
        #   self_training_updates: int,
        #   prototype_drift: float,
        #   replay_buffer: deque of Tensor
        # }
        self.registry: Dict[str, Dict[str, Any]] = {}

        ENROLLED_DIR.mkdir(parents=True, exist_ok=True)
        self._load_saved_prototypes()

    def _extract_embedding(self, tensor_batch: torch.Tensor) -> torch.Tensor:
        """Passes a batch of normalized image tensors through backbone and projection."""
        tensor_batch = tensor_batch.to(self.device)
        with torch.no_grad():
            feat = self.backbone(tensor_batch)
            proj = self.projection_head(feat)
        return proj.detach()

    def enroll_product_from_images(
        self,
        sku_name: str,
        images: List[np.ndarray],  # BGR numpy arrays (OpenCV format)
        category: str = "Retail General",
        designated_zone: str = "Top-Right Deck",
        reorder_threshold: int = 3,
        augment_factor: int = 3,
    ) -> Dict[str, Any]:
        """
        Enrolls a new product from 15–20 reference images:
          1. Multi-scale & color jitter augmentation
          2. Metric embedding extraction
          3. Unit-normalized prototype centroid computation
          4. Dynamic radius threshold calculation
        """
        if len(images) < 3:
            raise ValueError(f"Need at least 3 images for enrollment, received {len(images)}")

        sku_clean = sku_name.strip()
        sku_dir = ENROLLED_DIR / sku_clean.replace(" ", "_")
        sku_dir.mkdir(parents=True, exist_ok=True)

        # Save raw reference samples
        for idx, img in enumerate(images):
            save_path = sku_dir / f"ref_{idx:03d}.jpg"
            cv2.imwrite(str(save_path), img)

        # Generate augmented exemplar batch
        pil_images = [Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)) for img in images]
        tensors = []

        # Original un-augmented
        for pil_img in pil_images:
            tensors.append(TRANSFORM(pil_img))

        # Augmented variations
        for _ in range(augment_factor):
            for pil_img in pil_images:
                tensors.append(AUGMENTATION_TRANSFORM(pil_img))

        batch_tensors = torch.stack(tensors)  # Shape: [N, 3, 224, 224]

        with self.lock:
            with torch.no_grad():
                raw_feats = self.backbone(batch_tensors.to(self.device))
                embeddings = self.projection_head(raw_feats).detach()

            # Compute normalized centroid prototype
            mean_vector = torch.mean(embeddings, dim=0, keepdim=True)
            prototype = F.normalize(mean_vector, p=2, dim=1)  # [1, 128]

            # Compute intra-class pairwise cosine similarity distribution
            sims = torch.mm(embeddings, prototype.t()).squeeze(1).cpu().numpy()
            mean_sim = float(np.mean(sims))
            std_sim = float(np.std(sims))

            # Dynamic acceptance threshold: mean - 1.8 * std (bounded to [0.65, 0.88])
            threshold = float(np.clip(mean_sim - 1.8 * std_sim, 0.65, 0.88))

            prototype_cpu = prototype.cpu().clone()

            self.registry[sku_clean] = {
                "sku_name": sku_clean,
                "category": category,
                "designated_zone": designated_zone,
                "reorder_threshold": reorder_threshold,
                "prototype": prototype_cpu,
                "initial_prototype": prototype_cpu.clone(),
                "threshold": threshold,
                "mean_sim": round(mean_sim, 4),
                "enrolled_images_count": len(images),
                "total_augmented_samples": len(tensors),
                "total_observations": 0,
                "self_training_updates": 0,
                "prototype_drift": 0.0,
                "replay_buffer": [raw_feats[i:i+1].cpu().clone() for i in range(min(25, len(raw_feats)))],
                "enrolled_at": datetime.datetime.now().isoformat(),
                "last_seen_at": None,
            }

            self._save_prototypes()

        print(f"[FewShotEngine] Enrolled '{sku_clean}': Prototype generated (Threshold: {threshold:.3f}, Mean Sim: {mean_sim:.3f})")

        return {
            "sku_name": sku_clean,
            "category": category,
            "designated_zone": designated_zone,
            "reorder_threshold": reorder_threshold,
            "threshold": threshold,
            "mean_sim": round(mean_sim, 4),
            "enrolled_samples": len(images),
            "augmented_samples": len(tensors),
            "status": "ENROLLED_AND_ACTIVE",
        }

    def detect_and_match(
        self,
        frame: np.ndarray,
        candidate_boxes: List[List[int]],
    ) -> List[Dict[str, Any]]:
        """
        Extracts crops for candidate bounding boxes and compares against enrolled prototypes.
        Returns list of matched detections with SKU name, confidence, and box coordinates.
        """
        if not self.registry or not candidate_boxes:
            return []

        h, w = frame.shape[:2]
        matches: List[Dict[str, Any]] = []

        crops_tensors = []
        valid_boxes = []

        for bbox in candidate_boxes:
            x1, y1, x2, y2 = [int(v) for v in bbox]
            # Clip to frame
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            if (x2 - x1) < 20 or (y2 - y1) < 20:
                continue

            crop_bgr = frame[y1:y2, x1:x2]
            crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
            pil_crop = Image.fromarray(crop_rgb)
            crops_tensors.append(TRANSFORM(pil_crop))
            valid_boxes.append([x1, y1, x2, y2])

        if not crops_tensors:
            return []

        batch = torch.stack(crops_tensors)

        with self.lock:
            with torch.no_grad():
                raw_feats = self.backbone(batch.to(self.device))
                embeddings = self.projection_head(raw_feats).detach()

            for i, emb in enumerate(embeddings):
                emb_1d = emb.unsqueeze(0)  # [1, 128]

                best_sku = None
                best_sim = -1.0

                for sku_name, data in self.registry.items():
                    proto = data["prototype"].to(self.device)  # [1, 128]
                    sim = float(torch.mm(emb_1d, proto.t()).item())

                    if sim >= data["threshold"] and sim > best_sim:
                        best_sim = sim
                        best_sku = sku_name

                if best_sku is not None:
                    # Online Self-Training Trigger:
                    # Whenever the object is observed with high confidence,
                    # adapt the prototype via EMA and cache raw feature for continual backprop
                    raw_feat_1d = raw_feats[i:i+1].detach().cpu()
                    self._online_continual_step(best_sku, emb_1d.cpu().clone(), raw_feat_1d, best_sim)

                    matches.append({
                        "class_name": best_sku,
                        "class": best_sku,
                        "confidence": round(best_sim, 4),
                        "bbox": valid_boxes[i],
                        "few_shot": True,
                        "zone": self.registry[best_sku]["designated_zone"],
                    })

        return matches

    def _online_continual_step(
        self,
        sku_name: str,
        new_embedding: torch.Tensor,
        raw_feat: torch.Tensor,
        confidence: float,
    ) -> None:
        """
        Online continual learning step executed on the fly whenever the object is present:
          1. Momentum prototype update: mu <- norm((1 - alpha) * mu + alpha * z)
          2. Cache raw 576-dim feature to memory replay buffer
          3. Trigger incremental contrastive projection head fine-tuning every 10 sightings
        """
        if sku_name not in self.registry:
            return

        data = self.registry[sku_name]
        data["total_observations"] += 1
        data["last_seen_at"] = datetime.datetime.now().isoformat()

        # 1. Momentum EMA Prototype Adaptation
        alpha = float(0.04 * np.clip(confidence, 0.75, 0.98))
        current_proto = data["prototype"]  # [1, 128]
        updated_proto = F.normalize((1.0 - alpha) * current_proto + alpha * new_embedding, p=2, dim=1)
        data["prototype"] = updated_proto

        # Calculate prototype drift from cold-start enrollment
        drift = 1.0 - float(torch.mm(updated_proto, data["initial_prototype"].t()).item())
        data["prototype_drift"] = round(max(0.0, drift), 4)

        # 2. Add raw backbone feature to Online Replay Buffer (keep max 30 recent exemplars)
        data["replay_buffer"].append(raw_feat)
        if len(data["replay_buffer"]) > 30:
            data["replay_buffer"].pop(0)

        # 3. Incremental Contrastive Optimization (every 10 detections)
        if data["total_observations"] % 10 == 0:
            self._incremental_contrastive_finetune(sku_name)

    def _incremental_contrastive_finetune(self, target_sku: str) -> None:
        """
        Fine-tunes the metric projection head using the online replay buffer
        against negatives, preventing catastrophic forgetting and sharpening discrimination.
        """
        data = self.registry.get(target_sku)
        if not data or len(data["replay_buffer"]) < 3:
            return

        # Stack raw 576-dim features from the replay buffer
        raw_feats_batch = torch.cat(data["replay_buffer"][-15:], dim=0).to(self.device)  # [P, 576]
        proto = data["prototype"].to(self.device).detach()

        # Collect negative prototypes from other products
        neg_protos = [
            d["prototype"].to(self.device).detach()
            for k, d in self.registry.items()
            if k != target_sku
        ]

        self.projection_head.train()
        for _ in range(3):
            self.optimizer.zero_grad()

            # Forward pass through projection head with autograd tracking!
            projected = self.projection_head(raw_feats_batch)  # [P, 128]

            # Contrastive Pull Loss: pull positive exemplars toward the active prototype
            pos_sim = torch.mm(projected, proto.t())  # [P, 1]
            pull_loss = torch.mean(1.0 - pos_sim)

            # Contrastive Push Loss: push away other product prototypes
            push_loss = torch.tensor(0.0, device=self.device)
            if neg_protos:
                stacked_negs = torch.cat(neg_protos, dim=0)  # [N, 128]
                neg_sim = torch.mm(projected, stacked_negs.t())  # [P, N]
                push_loss = torch.mean(F.relu(neg_sim - 0.25))

            loss = pull_loss + 0.5 * push_loss
            loss.backward()
            self.optimizer.step()

        self.projection_head.eval()
        data["self_training_updates"] += 1
        self._save_prototypes()
        print(f"[FewShotEngine] Continual Self-Training Pass #{data['self_training_updates']} completed for '{target_sku}'.")

    def get_registry_summary(self) -> List[Dict[str, Any]]:
        """Returns JSON-serializable telemetry for all enrolled few-shot products."""
        with self.lock:
            summary = []
            for name, data in self.registry.items():
                summary.append({
                    "sku_name": data["sku_name"],
                    "category": data["category"],
                    "designated_zone": data["designated_zone"],
                    "reorder_threshold": data["reorder_threshold"],
                    "detection_threshold": data["threshold"],
                    "total_observations": data["total_observations"],
                    "self_training_updates": data["self_training_updates"],
                    "prototype_drift_pct": round(data["prototype_drift"] * 100.0, 2),
                    "enrolled_at": data["enrolled_at"],
                    "last_seen_at": data["last_seen_at"],
                    "status": "ONLINE_LEARNING_ACTIVE",
                })
            return summary

    def delete_product(self, sku_name: str) -> bool:
        """Removes an enrolled product from the active registry."""
        with self.lock:
            if sku_name in self.registry:
                del self.registry[sku_name]
                self._save_prototypes()
                return True
            return False

    def _save_prototypes(self) -> None:
        """Saves current prototypes and telemetry to disk."""
        state_dict_to_save = {
            "head_state": self.projection_head.state_dict(),
            "prototypes": {k: v["prototype"] for k, v in self.registry.items()},
            "initial_prototypes": {k: v["initial_prototype"] for k, v in self.registry.items()},
        }
        torch.save(state_dict_to_save, PROTOTYPES_PT)

        json_meta = {
            "version": "1.0",
            "saved_at": datetime.datetime.now().isoformat(),
            "products": {
                k: {
                    "sku_name": v["sku_name"],
                    "category": v["category"],
                    "designated_zone": v["designated_zone"],
                    "reorder_threshold": v["reorder_threshold"],
                    "threshold": v["threshold"],
                    "total_observations": v["total_observations"],
                    "self_training_updates": v["self_training_updates"],
                    "prototype_drift": v["prototype_drift"],
                    "enrolled_at": v["enrolled_at"],
                    "last_seen_at": v["last_seen_at"],
                }
                for k, v in self.registry.items()
            }
        }
        with open(PROTOTYPES_JSON, "w", encoding="utf-8") as f:
            json.dump(json_meta, f, indent=2)

    def _load_saved_prototypes(self) -> None:
        """Restores persisted prototypes and projection head weights on startup."""
        if not PROTOTYPES_PT.exists() or not PROTOTYPES_JSON.exists():
            return

        try:
            with open(PROTOTYPES_JSON, "r", encoding="utf-8") as f:
                json_meta = json.load(f)

            pt_data = torch.load(PROTOTYPES_PT, map_location="cpu")
            if "head_state" in pt_data:
                self.projection_head.load_state_dict(pt_data["head_state"])

            saved_protos = pt_data.get("prototypes", {})
            saved_inits = pt_data.get("initial_prototypes", {})

            for name, meta in json_meta.get("products", {}).items():
                if name in saved_protos:
                    proto = saved_protos[name]
                    init_proto = saved_inits.get(name, proto.clone())

                    # Restore raw feature vectors for continual replay buffer
                    replay_buf = []
                    sku_dir = ENROLLED_DIR / name.replace(" ", "_")
                    if sku_dir.is_dir():
                        for p in sorted(list(sku_dir.glob("*.jpg")))[:15]:
                            im = cv2.imread(str(p))
                            if im is not None:
                                pil_im = Image.fromarray(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
                                t = TRANSFORM(pil_im).unsqueeze(0).to(self.device)
                                with torch.no_grad():
                                    replay_buf.append(self.backbone(t).cpu())
                    if not replay_buf:
                        replay_buf = [torch.randn(1, 576)]

                    self.registry[name] = {
                        "sku_name": meta["sku_name"],
                        "category": meta["category"],
                        "designated_zone": meta["designated_zone"],
                        "reorder_threshold": meta["reorder_threshold"],
                        "prototype": proto,
                        "initial_prototype": init_proto,
                        "threshold": meta["threshold"],
                        "total_observations": meta["total_observations"],
                        "self_training_updates": meta["self_training_updates"],
                        "prototype_drift": meta["prototype_drift"],
                        "replay_buffer": replay_buf,
                        "enrolled_at": meta["enrolled_at"],
                        "last_seen_at": meta["last_seen_at"],
                    }

            print(f"[FewShotEngine] Restored {len(self.registry)} enrolled few-shot prototypes from disk.")
        except Exception as e:
            print(f"[FewShotEngine] Failed to restore prototypes: {e}")


# Global singleton instance
few_shot_engine = ShelfSenseFewShotContinualEngine()