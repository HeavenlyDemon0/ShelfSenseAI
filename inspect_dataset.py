"""
ShelfSense AI — Authoritative Dataset Inspection Script
=======================================================
Inspects the authoritative product-first dataset at: datasets/final/
Classes:
  0: CocaCola
  1: KitKat
  2: Lays
  3: Oreo
"""

from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATASET_DIR = ROOT / "datasets" / "final"

CLASS_NAMES = {
    0: "CocaCola",
    1: "KitKat",
    2: "Lays",
    3: "Oreo",
}

PRODUCTS = ["cocacola", "kitkat", "lays", "oreo"]
SPLITS = ["train", "val", "test"]


def inspect_dataset():
    print("=" * 70)
    print("SHELFSENSE AI — AUTHORITATIVE DATASET INSPECTION")
    print(f"Dataset Location: {DATASET_DIR}")
    print("=" * 70)

    if not DATASET_DIR.is_dir():
        print(f"ERROR: Dataset directory not found at {DATASET_DIR}")
        return

    grand_total_images = 0
    grand_total_labels = 0
    grand_total_boxes = 0
    grand_total_negatives = 0
    overall_class_counts = Counter()

    for prod in PRODUCTS:
        print(f"\nProduct: {prod.upper()}")
        prod_dir = DATASET_DIR / prod
        if not prod_dir.is_dir():
            print(f"  Directory missing: {prod_dir}")
            continue

        for sp in SPLITS:
            img_dir = prod_dir / sp / "images"
            lbl_dir = prod_dir / sp / "labels"

            imgs = list(img_dir.glob("*.jpg")) if img_dir.is_dir() else []
            lbls = list(lbl_dir.glob("*.txt")) if lbl_dir.is_dir() else []

            box_count = 0
            empty_count = 0

            for lf in lbls:
                lines = [line.strip().split() for line in lf.read_text(encoding="utf-8").splitlines() if line.strip()]
                if not lines:
                    empty_count += 1
                else:
                    for parts in lines:
                        try:
                            cid = int(parts[0])
                            overall_class_counts[cid] += 1
                            box_count += 1
                        except ValueError:
                            pass

            grand_total_images += len(imgs)
            grand_total_labels += len(lbls)
            grand_total_boxes += box_count
            grand_total_negatives += empty_count

            print(f"  {sp:<6}: {len(imgs):>4} images | {len(lbls):>4} labels | {box_count:>5} boxes | {empty_count:>3} background negatives")

    print("\n" + "=" * 70)
    print("SUMMARY TOTALS")
    print("=" * 70)
    print(f"Total Images:              {grand_total_images}")
    print(f"Total Labels:              {grand_total_labels}")
    print(f"Total Bounding Boxes:      {grand_total_boxes}")
    print(f"Total Background Negatives:{grand_total_negatives}")

    print("\nGlobal Class Distribution:")
    for cid, name in CLASS_NAMES.items():
        print(f"  {cid}: {name:<10} {overall_class_counts[cid]:>6} boxes")

    print("=" * 70)


if __name__ == "__main__":
    inspect_dataset()