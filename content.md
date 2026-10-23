## Problem Statement

Retail stores need to keep shelves properly stocked, organized, and ready for customers, but monitoring shelf conditions manually is time-consuming and difficult to do continuously. Store employees or supervisors have to check whether products are present, whether the correct products are in the correct places, and whether enough units are available. With multiple products and frequent customer activity, items can be picked up, misplaced, or run out without being noticed immediately, which can lead to empty or poorly organized shelves and reduced product availability.

Another challenge is that store staff do not have a simple, continuous way to understand the current condition of a shelf at a glance. Checking products manually requires repeatedly counting items and comparing their quantities with the expected stock level. This becomes especially difficult when several different products are placed together or when shelf conditions change throughout the day. As a result, identifying low-stock situations, missing products, and misplaced items can depend heavily on manual observation.

Therefore, there is a need for a system that can continuously understand the state of retail shelves and provide clear, timely information about their condition. Such a system should be able to handle multiple products simultaneously, recognize changes in shelf contents, determine whether products are sufficiently stocked and correctly positioned, and present this information in a way that helps store personnel monitor and respond to shelf-related problems efficiently.

# ShelfSense — Final Technical Solution

ShelfSense is a low-cost, single-camera intelligent shelf-monitoring and replenishment-prioritization system designed for retail environments where camera observations may be unreliable. The system uses computer vision to observe shelf products, but its primary technical contribution is not simply detecting products. Instead, ShelfSense is designed to determine how much **trustworthy shelf-state information can be recovered from noisy visual observations**, and how that information can still be converted into reliable replenishment priorities.

The system initially monitors four products: **Lays, KitKat, Pepsi, and Coca-Cola**. A low-cost camera such as an **ESP32-CAM** captures the shelf. The camera is deliberately treated as an imperfect sensing device because real deployments may involve low resolution, image compression, poor lighting, motion blur, different camera distances, partial visibility, and temporary occlusion caused by customers or employees.

YOLO performs the initial product detection, while object tracking and temporal reasoning determine whether individual observations are reliable enough to represent actual changes in the shelf. The resulting information is processed by the ShelfSense Intelligence Engine, which maintains shelf state, estimates quantities and product movement, detects misplacement and stockout conditions, estimates uncertainty, and produces replenishment priorities. FastAPI exposes this processed state to the dashboard.

---

# 1. Overall Technical Approach

The complete system follows:

**Camera → YOLO Detection → Object Tracking → Temporal Verification → Uncertainty Estimation → ShelfSense Intelligence Engine → FastAPI → Dashboard**

The camera continuously provides shelf images. YOLO identifies the visible products and produces detections containing information such as class, confidence, and bounding-box location.

The tracking component associates detections across consecutive frames so that the same physical product can be followed over time.

Instead of accepting every YOLO detection immediately, ShelfSense evaluates observations across multiple frames. A detection that appears for only one frame is not automatically treated as a real shelf event. The system examines persistence, track continuity, detector confidence, occlusion history, and positional consistency before confirming a change.

The confirmed observations are then passed to the ShelfSense Intelligence Engine, which converts them into a structured representation of the shelf and performs the higher-level reasoning required by the application.

---

# 2. Core Technical Novelty

The novelty of ShelfSense is **not** YOLO detection, basic counting, object tracking, zone-based misplacement detection, out-of-stock detection, consumption velocity, or the mathematical Health Score individually. These are supporting components.

The primary contribution is a **temporally robust and uncertainty-aware shelf-state estimation pipeline designed for severely degraded single-camera input**, combined with a **few-shot product enrollment mechanism that allows new products to be introduced using only 5–15 images without full YOLO retraining**, while explicitly measuring whether the resulting product information remains reliable enough for downstream inventory decisions.

The system addresses two connected technical questions.

### A. Robustness under unreliable camera observations

When an ESP32-CAM produces unreliable observations because of low resolution, compression, lighting changes, motion blur, camera distance, partial occlusion, and detection flickering, how much reliable shelf-state information can still be recovered?

ShelfSense addresses this using:

* temporal verification,
* object-track continuity,
* multi-factor observation confidence,
* occlusion history,
* detection persistence,
* positional consistency,
* uncertainty estimation.

The system does not treat a single frame as ground truth.

### B. Few-shot product adaptation

When a new product is introduced using only **5, 10, or 15 images**, can the system recognize and track that product sufficiently well for it to participate in the same inventory and replenishment pipeline without completely retraining the primary YOLO model?

The answer will be evaluated not only through recognition accuracy, but through the effect on:

* quantity estimation,
* consumption estimation,
* shelf-state accuracy,
* uncertainty,
* Health Score,
* replenishment ranking.

This makes few-shot enrollment part of the core technical evaluation rather than simply an additional dashboard feature.

---

# 3. Robustness to Real ESP32-CAM Conditions

The system is specifically designed around the assumption that the camera is unreliable.

Testing will deliberately introduce difficult conditions including:

* poor lighting,
* changing illumination,
* low-resolution frames,
* image compression,
* motion blur,
* different camera distances,
* partial product visibility,
* hands covering products,
* temporary occlusion,
* intermittent detection,
* visually similar products.

Rather than attempting to make YOLO alone solve every problem, ShelfSense adds a temporal reasoning layer after detection.

For example:

**Frame 1:** 5 Lays detected
**Frame 2:** 4 Lays detected because a hand covers one
**Frame 3:** 5 Lays detected again

A frame-level counter may interpret this as a removal and addition.

ShelfSense instead examines the temporal sequence and recognizes that the disappearance was temporary. The shelf quantity can therefore remain at five.

Conversely:

**5 → 5 → 4 → 4 → 4**

with stable tracking and no evidence of temporary occlusion provides substantially stronger evidence that one unit was actually removed.

This temporal reasoning is central to the system.

---

# 4. Concrete Temporal Verification Method

For every tracked object, ShelfSense maintains a short history of observations.

The history includes:

* track ID,
* number of consecutive detections,
* detector confidence,
* position over time,
* time since first observation,
* time since last observation,
* occlusion duration,
* detection stability,
* movement/position consistency.

A shelf event is not confirmed solely because a detection appeared or disappeared once.

Instead, the engine uses configurable temporal rules.

For example, a potential removal can enter a temporary **uncertain state** before becoming a confirmed removal. If the product reappears quickly, the event is discarded as a temporary observation failure. If the disappearance persists and the historical evidence supports it, the removal becomes confirmed.

The same principle is applied to newly appearing products.

This creates a distinction between:

**Raw detection → suspected event → verified event**

rather than:

**Raw detection → immediate inventory change.**

---

# 5. Multi-Factor Uncertainty Estimation

Uncertainty is treated as a first-class signal throughout the system.

The engine calculates an observation reliability estimate using multiple measurable signals rather than detector confidence alone.

The uncertainty estimator will incorporate factors such as:

### Detector confidence

Higher YOLO confidence contributes stronger evidence.

### Track age

A product that has been consistently tracked for many frames is more trustworthy than an object appearing for a single frame.

### Consecutive detection count

Repeated observations increase confidence in the existence of the object.

### Occlusion duration

Longer periods where an object is partially or completely hidden increase uncertainty about its current state.

### Position consistency

Abrupt or physically implausible changes in the object's location can indicate unstable tracking or incorrect association.

### Detection stability

Repeated class changes or bounding-box flickering decrease confidence.

These signals are combined into an observation confidence/reliability value.

Conceptually:

**Observation Reliability = f(detector confidence, track age, temporal consistency, occlusion, positional stability, detection persistence)**

The exact weighting will be determined experimentally rather than arbitrarily fixed.

---

# 6. Measuring Whether Uncertainty Actually Helps

The uncertainty mechanism will itself be evaluated.

Two versions of the decision pipeline will be compared:

**Pipeline A:** uses shelf quantities and decisions without uncertainty.

**Pipeline B:** uses the proposed uncertainty-aware processing.

The comparison will measure whether uncertainty reduces:

* false high-priority replenishment recommendations,
* false stockout events,
* false product removals,
* incorrect quantity changes,
* incorrect replenishment rankings.

This is important because uncertainty will not be claimed as novel merely because it exists in the architecture. Its value must be demonstrated experimentally.

The target is to show that unreliable observations are less likely to propagate into confident but incorrect operational decisions.

---

# 7. Few-Shot Product Enrollment

The system initially operates with four known products:

* **Lays**
* **KitKat**
* **Pepsi**
* **Coca-Cola**

A fifth product can be introduced using only **5–15 images**.

The primary YOLO model does not need to be completely retrained for every newly introduced product.

The proposed enrollment pipeline is:

**New Product → 5–15 Images → Visual Feature Extraction → Prototype Creation → Similarity Matching → Temporal Verification → Uncertainty Estimation → ShelfSense Integration**

A frozen lightweight visual feature extractor/embedding model is used to convert product images into feature representations.

The representations from the enrollment images are combined to create a prototype representing the new product.

When a candidate object does not correspond confidently to one of the existing four YOLO classes, its visual representation can be compared with the enrolled product prototype using a similarity measure such as cosine similarity.

A candidate is accepted only when the visual similarity and temporal evidence are sufficiently strong.

This prevents a single visually similar object from automatically becoming a new product detection.

---

# 8. Few-Shot Evaluation

The fifth product will be evaluated using three enrollment sizes:

**5 images → 10 images → 15 images**

The experiment will measure:

* recognition accuracy,
* false recognition rate,
* missed detections,
* counting accuracy,
* tracking stability,
* uncertainty,
* consumption estimation accuracy,
* Health Score error,
* replenishment ranking accuracy.

The fifth product will also be tested under the same degraded ESP32-CAM conditions used for the original four products.

Visually similar products will be included as **hard negatives** to determine whether the few-shot mechanism incorrectly identifies similar packaging as the enrolled product.

The key question is therefore not:

> “Can five images recognize a new product?”

but:

> **“Can five to fifteen images introduce a new product while preserving useful downstream shelf and replenishment decisions?”**

---

# 9. ShelfSense Intelligence Engine

The **ShelfSense Intelligence Engine is the central software reasoning component of the system.**

It is not another neural network.

It is a software engine responsible for converting structured computer-vision observations into a continuously maintained shelf state and operational decisions.

The engine receives structured information from YOLO and the tracking subsystem, including:

* product class,
* confidence,
* bounding box,
* track ID,
* timestamp,
* detection history.

It maintains historical information for each tracked product and uses it to determine whether observations represent genuine shelf events.

Its responsibilities include:

* temporal observation verification,
* track-history management,
* quantity estimation,
* product addition/removal detection,
* uncertainty estimation,
* consumption-history maintenance,
* misplacement detection,
* out-of-stock detection,
* Health Score calculation,
* replenishment prioritization.

The engine therefore transforms:

**“YOLO sees four Pepsi detections.”**

into something closer to:

**“The shelf is currently estimated to contain four Pepsi units, the estimate has high/medium/low reliability, one unit was likely removed recently, recent consumption is X, and the resulting replenishment urgency is Y.”**

---

# 10. Misplacement Detection

The shelf is divided into predefined product zones representing where products are expected to be placed.

For example:

**Zone A → Lays**
**Zone B → KitKat**
**Zone C → Pepsi**
**Zone D → Coca-Cola**

When a product is reliably detected in an incorrect zone, the engine records a potential misplacement.

Temporal verification prevents a single uncertain detection from immediately generating a persistent misplacement event.

Once the observation becomes sufficiently reliable, the product appears in the dedicated misplacement section of the dashboard.

When subsequent observations confirm that the product has been returned to its expected zone, the misplacement state is removed.

---

# 11. Out-of-Stock Detection

The engine maintains an estimated quantity for every monitored product.

When the confirmed quantity reaches zero and remains sufficiently reliable, the product is classified as out of stock.

It is then displayed in the dedicated out-of-stock section.

When the product is subsequently detected and verified again, its out-of-stock state is cleared.

This prevents temporary occlusion from being interpreted as a genuine stockout.

---

# 12. Health Score and Replenishment Prioritization

The Health Score is not presented as a novel machine-learning model.

It is a transparent mathematical decision function built on top of the shelf-state information produced by the vision and temporal reasoning system.

For every product, the engine maintains information such as:

* current estimated quantity,
* recent quantity changes,
* units removed during a recent time window,
* estimated consumption rate,
* observation confidence,
* uncertainty.

The Health Score will be designed as a generalized normalized mathematical function combining current availability with recent consumption.

The basic principle is:

**low stock + high consumption = greater replenishment urgency**

while:

**adequate stock + low consumption = lower urgency.**

The exact formula and its weights will be experimentally derived and validated.

A replenishment threshold will then be applied so that products are not unnecessarily recommended for restocking.

Products crossing the threshold will be sorted by replenishment urgency, with the highest-priority items presented first.

Importantly, uncertainty can influence the reliability of the recommendation. A product appearing critically low with strong evidence should be treated differently from one appearing critically low because the camera has been heavily occluded.

---

# 13. FastAPI Communication Layer

FastAPI provides the communication interface between the ShelfSense backend and the dashboard.

The engine itself performs the shelf-state calculations. FastAPI exposes the resulting state through HTTP endpoints.

For example:

**GET `/api/state`**

returns structured information such as:

* camera status,
* timestamp,
* product quantities,
* detections,
* shelf events,
* confidence/uncertainty,
* stock status,
* replenishment information.

The dashboard can control the processing system through endpoints such as:

**POST `/api/camera/start`**

and

**POST `/api/camera/stop`.**

Therefore, FastAPI is not performing YOLO detection or calculating the Health Score. Its technical role is to provide a controlled communication interface through which the frontend can retrieve the current state and send commands to the backend.

---

# 14. Dashboard

The dashboard provides the human-facing interface for the system.

It contains sections for:

* overall shelf status,
* product quantities,
* misplacements,
* out-of-stock products,
* replenishment priorities,
* Health Scores,
* uncertainty/confidence,
* recent activity,
* analytical graphs.

When the camera is off, the dashboard does not receive new shelf observations, so its state remains unchanged.

When the camera is active, it retrieves updated backend state.

The interface can use adaptive polling:

* approximately **1 second when meaningful changes are occurring**,
* approximately **5 seconds when the shelf state remains unchanged**.

This allows the interface to remain responsive to actual shelf events without continuously making unnecessary high-frequency requests.

---

# 15. Complete Technical Flow

```text
                         ┌───────────────────────┐
                         │      Retail Shelf     │
                         │ Lays / KitKat / Pepsi │
                         │      / Coca-Cola      │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │ Low-Cost Camera       │
                         │ ESP32-CAM Class       │
                         └───────────┬───────────┘
                                     │
                              Image Frames
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │ YOLO Detector         │
                         │                       │
                         │ 4 Known Classes       │
                         │ Lays                  │
                         │ KitKat                │
                         │ Pepsi                 │
                         │ Coca-Cola             │
                         └───────────┬───────────┘
                                     │
                              Raw Detections
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │ Object Tracker        │
                         │                       │
                         │ Track IDs             │
                         │ Track History         │
                         │ Object Association    │
                         └───────────┬───────────┘
                                     │
                                     ▼
              ┌──────────────────────────────────────────┐
              │ Temporal + Reliability Processing        │
              │                                          │
              │ • Detection persistence                  │
              │ • Track age                               │
              │ • Consecutive detections                 │
              │ • Occlusion history                       │
              │ • Position consistency                    │
              │ • Detector confidence                     │
              │ • Detection stability                    │
              └────────────────────┬─────────────────────┘
                                   │
                          Verified Observations
                                   │
                                   ▼
              ┌──────────────────────────────────────────┐
              │ ShelfSense Intelligence Engine           │
              │                                          │
              │ • Shelf-state estimation                 │
              │ • Quantity estimation                     │
              │ • Add/remove event detection              │
              │ • Consumption history                     │
              │ • Uncertainty estimation                  │
              │ • Misplacement detection                  │
              │ • Out-of-stock detection                  │
              │ • Health Score                            │
              │ • Replenishment prioritization            │
              └────────────────────┬─────────────────────┘
                                   │
                                   ▼
                         ┌───────────────────────┐
                         │      FastAPI          │
                         │                       │
                         │ REST API              │
                         │ State Retrieval       │
                         │ Camera Controls       │
                         └───────────┬───────────┘
                                     │
                                  JSON State
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │ ShelfSense Dashboard  │
                         │                       │
                         │ Home                  │
                         │ Misplacements         │
                         │ Out of Stock          │
                         │ Replenishment         │
                         │ Health Scores         │
                         │ Analytics             │
                         └───────────────────────┘
```

### Few-Shot Enrollment Flow

```text
                  New Product
                       │
                       ▼
                Capture 5–15 Images
                       │
                       ▼
             Visual Feature Extraction
                       │
                       ▼
              Prototype Generation
                       │
                       ▼
             Similarity-Based Matching
                       │
                       ▼
              Temporal Verification
                       │
                       ▼
             Multi-Factor Uncertainty
                       │
                       ▼
              Shelf-State Integration
                       │
                       ▼
              Quantity + Consumption
                       │
                       ▼
                 Health Score
                       │
                       ▼
            Replenishment Ranking
```

---

# 16. Experimental Baseline

A strong baseline will be established before evaluating the proposed improvements.

### Baseline system

The baseline will use:

**YOLO detection → direct frame-level counting**

without the proposed temporal verification and uncertainty-aware reasoning.

This represents what happens when detections are treated relatively directly.

### Proposed system

The complete ShelfSense pipeline will use:

**YOLO → tracking → temporal verification → multi-factor uncertainty → shelf-state estimation → decision layer**

The two systems will be exposed to identical test conditions.

---

# 17. Controlled Degradation Experiments

The same shelf setup will be tested under progressively difficult visual conditions.

The experiments will vary:

1. lighting quality,
2. lighting changes,
3. camera distance,
4. image resolution,
5. compression,
6. motion blur,
7. hand occlusion,
8. partial product visibility,
9. detection instability.

For each condition, the system will record measurable performance.

Important metrics will include:

* counting accuracy,
* quantity estimation error,
* false removal rate,
* false addition rate,
* false stockout rate,
* misplacement detection accuracy,
* replenishment ranking error.

The central experiment will compare how much performance is lost by the baseline and how much of that performance the temporal and uncertainty-aware pipeline can recover.

---

# 18. Measuring Decision Quality

The project will specifically evaluate whether better visual processing produces better operational decisions.

For replenishment ranking, the system will compare its predicted order against a ground-truth priority order established from the known shelf events.

The evaluation will examine:

* correct highest-priority product,
* ranking errors,
* false high-priority recommendations,
* missed urgent products,
* Health Score estimation error.

This prevents the project from claiming success merely because the detector has a reasonable object-detection accuracy.

The actual question becomes:

> **Does improved temporal and uncertainty-aware perception produce better replenishment decisions?**

---

# 19. Few-Shot Experimental Matrix

The fifth product will be tested under:

| Enrollment | Camera Condition | Evaluation                         |
| ---------- | ---------------- | ---------------------------------- |
| 5 images   | Normal           | Recognition + downstream decisions |
| 10 images  | Normal           | Recognition + downstream decisions |
| 15 images  | Normal           | Recognition + downstream decisions |
| 5 images   | Degraded         | Recognition + downstream decisions |
| 10 images  | Degraded         | Recognition + downstream decisions |
| 15 images  | Degraded         | Recognition + downstream decisions |

The experiment will determine the minimum number of enrollment images required to achieve acceptable downstream performance.

The objective is not simply to show that 15 images work. It is to determine how the number of examples affects the entire ShelfSense pipeline.

---

# 20. Measuring the Value of Uncertainty

The uncertainty mechanism will be evaluated against a version of the system that ignores uncertainty.

For example, if two products have identical estimated stock levels but one has:

**High confidence + stable tracking**

while the other has:

**Low confidence + heavy occlusion + unstable tracking,**

the uncertainty-aware system should avoid treating their replenishment recommendations as equally trustworthy.

The experiment will quantify whether this reduces false high-priority decisions.

The specific signals evaluated will include:

* detector confidence,
* track age,
* consecutive detections,
* occlusion duration,
* position variance,
* temporal stability.

The relationship between these signals and actual correctness will be measured using held-out test data, allowing the uncertainty calculation to be calibrated rather than chosen purely by intuition.

---

# 21. Main Novelty Claim

**ShelfSense proposes a low-cost, single-camera shelf intelligence system that does not assume its visual observations are reliable. It combines temporal verification, measurable multi-factor uncertainty estimation, and few-shot product enrollment to recover useful shelf-state information and preserve replenishment decision quality under degraded camera conditions.**

The system therefore shifts the focus from:

**“Can a camera detect products?”**

to:

**“Can a low-cost and unreliable camera still provide trustworthy inventory decisions?”**

The four initial products—**Lays, KitKat, Pepsi, and Coca-Cola**—provide the controlled base environment for evaluating the system. A fifth product introduced using only **5–15 images** tests whether the approach can adapt without full detector retraining.

The technical contribution will be supported through controlled experiments comparing:

**frame-level YOLO counting vs temporal reasoning**,
**decision making without uncertainty vs uncertainty-aware decision making**, and
**5-shot vs 10-shot vs 15-shot product enrollment**,

with evaluation extending beyond recognition to **counting accuracy, false state changes, uncertainty quality, consumption estimation, and replenishment-ranking accuracy**.

This makes the proposed work an experimentally testable investigation into how much reliable retail shelf intelligence can be extracted from inexpensive, imperfect visual sensing while remaining adaptable to new products with extremely limited training data.
