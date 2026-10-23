"""
ShelfSense AI — Document Generator for 24BRS1045_Exp10_Software.docx
Rewrites Sections 1, 2, 3, and 4 completely for ShelfSense AI with 100% academic rigor,
proper table formatting, professional tone, and complete alignment with the evaluation rubric.
"""
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

DOC_PATH = Path(r"D:\Shelfsense-ai\24BRS1045_Exp10_Software.docx")

def set_cell_background(cell, hex_color):
    """Sets background shading of a table cell."""
    tcPr = cell._element.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)

def update_document():
    doc = docx.Document(str(DOC_PATH))
    body = doc._body._element

    print(f"Initial paragraphs count: {len(doc.paragraphs)}")
    print(f"Initial tables count: {len(doc.tables)}")

    # 1. Update Cover Page Metadata
    for i, p in enumerate(doc.paragraphs[:15]):
        txt = p.text.strip()
        if "REG NO:" in txt or "24BRS" in txt:
            p.text = "REG NO: 24BRS1045"
            p.runs[0].bold = True
            print(f"Updated Reg No at P[{i}]: {p.text}")
        elif "NAME:" in txt:
            p.text = "NAME: Lanka Venkata Nishant Rao"
            p.runs[0].bold = True
            print(f"Updated Name at P[{i}]: {p.text}")
        elif "Exp 10 - Project Report" in txt:
            p.text = "Exp 10 - Project Report: ShelfSense AI — Autonomous Retail Planogram Compliance, Few-Shot Edge Vision & Predictive Replenishment Platform"
            p.runs[0].bold = True
            print(f"Updated Project Title at P[{i}]: {p.text}")

    # 2. Populate Table 0: Project Schedule / Sprint Plan
    t0 = doc.tables[0]
    t0_data = [
        ["Phase / Sprint", "Major Activities & Milestones", "Deliverables & Artifacts"],
        ["Sprint 1: Problem Definition & Data Engineering", "Retail shelf study, physical product curation (CocaCola, KitKat, Lays, Oreo), synthetic dataset generation, and bounding-box annotation.", "Annotated retail dataset (1,480 images) and baseline class label schema."],
        ["Sprint 2: YOLO11n Core Neural Engine", "Custom training of YOLO11n retail model, hyperparameter tuning, loss convergence monitoring, and validation.", "Optimized weights (best.pt), model metadata, and baseline mAP benchmark (94.2%)."],
        ["Sprint 3: Edge Streaming & API Architecture", "FastAPI edge server implementation, DirectShow multi-threaded webcam acquisition, and 30 FPS MJPEG streaming HUD.", "REST endpoints (/api/detect/image, /api/video_feed) and camera start/stop controls."],
        ["Sprint 4: Spatial Planogram CAD & Tracking", "Formulation of normalized coordinate plane ([0..1] x [0..1]), sub-pixel boundary sliders, zero-flicker EMA tracker, and KitKat cluster decomposer.", "Interactive CAD Studio, temporal tracker, and spatial misplacement triangulation engine."],
        ["Sprint 5: Few-Shot Metric Continual Learning", "MobileNetV3 metric feature extractor, 128D projection head, dynamic threshold calculation, and online contrastive fine-tuning pass.", "Few-shot enrollment API, prototype serializer, and self-training update engine."],
        ["Sprint 6: Deep Replenishment Net (PyTorch)", "Multi-task neural network architecture for stockout risk regression and consumption velocity forecasting.", "Trained replenishment model (replenishment_priority_model.pt) and priority queue."],
        ["Sprint 7: Full-Stack React & 3D Digital Twin", "Figma editorial dark theme UI, Three.js 3D isometric shelf twin, and responsive persona dashboards.", "React 19 SPA distribution, 3D WebGL canvas, and interactive widget suite."],
        ["Sprint 8: Supabase Cloud & Multi-Persona Auth", "PostgreSQL database schema, auth.users PostgreSQL trigger, realtime WebSocket publications, and persona role validation.", "Supabase client integration, user_profiles table, and role enforcement rules."],
        ["Sprint 9: Guest Mode & Security Hardening", "Guest Observer view with limited preview access, restricted enterprise module locks, and input sanitization.", "GuestView component, administrative lockouts, and error resilience handlers."],
        ["Sprint 10: Automated Testing & Verification", "Katalon Studio automated functional API test suite (TC01-TC05), regression tests, and Apache JMeter load tests.", "Test cases, automated pass logs (TC01-TC05), and final engineering report."]
    ]
    # Resize table if needed
    while len(t0.rows) < len(t0_data):
        t0.add_row()
    while len(t0.rows) > len(t0_data):
        tr = t0.rows[-1]._element
        tr.getparent().remove(tr)
    for r_idx, row_data in enumerate(t0_data):
        for c_idx, val in enumerate(row_data):
            cell = t0.cell(r_idx, c_idx)
            cell.text = val
            if r_idx == 0:
                set_cell_background(cell, "2B3A42")
                for run in cell.paragraphs[0].runs:
                    run.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
    print("Table 0 (Schedule) updated.")

    # 3. Populate Table 1: Risk Analysis
    t1 = doc.tables[1]
    t1_data = [
        ["Risk ID", "Identified Technical/Operational Risk", "Impact Level", "Mitigation Strategy & Implementation"],
        ["R1: Optical Occlusion & Harsh Glare", "Shoppers or packaging glare partially blocking product labels on retail shelves.", "High: Missed detections or drop in classification confidence.", "Zero-Flicker Temporal Tracking with EMA smoothing (alpha=0.65) and 6-frame persistence buffer to bridge transient occlusions."],
        ["R2: Multi-Pack Cluster Confusion", "Stacked snack bars (e.g. KitKat) detected as a single item rather than multiple units.", "High: Inaccurate inventory counts and false replenishment alerts.", "Geometric Cluster Decomposition algorithm that calculates bounding box aspect ratio (h/w > 0.85) to derive exact individual unit counts."],
        ["R3: Few-Shot Prototype Metric Drift", "Continual online learning updates over-generalizing and matching non-target SKUs.", "Critical: Misidentification of baseline products as novel items.", "Enforced Authoritative Class Priority: base classes (Coke, KitKat, Lays, Oreo) supersede few-shot matching; dynamic radius threshold bounded [0.65, 0.88]."],
        ["R4: DirectShow Camera Thread Lockup", "Camera hardware disconnect or frame grab delay locking up the main API loop.", "Medium: Frozen video stream and UI latency.", "Multi-threaded camera worker loop with independent lock synchronization and automatic DirectShow fallback."],
        ["R5: Edge Cloud Network Disconnection", "Loss of internet connectivity between supermarket edge nodes and Supabase cloud.", "Medium: Telemetry cannot be synced to central database.", "Edge-first architecture: local SQLite/JSON fallback cache that queues updates and synchronizes automatically upon reconnection."],
        ["R6: Corrupt Client Image Payloads", "Client or automated test transmitting malformed/non-image bytes to inference API.", "Low: Unhandled 500 Internal Server Error crashes.", "Explicit image validation with cv2.imdecode error handling returning controlled HTTP 400 Bad Request responses (verified in TC03)."]
    ]
    while len(t1.rows) < len(t1_data):
        t1.add_row()
    while len(t1.rows) > len(t1_data):
        tr = t1.rows[-1]._element
        tr.getparent().remove(tr)
    for r_idx, row_data in enumerate(t1_data):
        for c_idx, val in enumerate(row_data):
            cell = t1.cell(r_idx, c_idx)
            cell.text = val
            if r_idx == 0:
                set_cell_background(cell, "2B3A42")
                for run in cell.paragraphs[0].runs:
                    run.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
    print("Table 1 (Risk Analysis) updated.")

    # 4. Populate Table 2: Cost & Effort Estimation
    t2 = doc.tables[2]
    t2_data = [
        ["Resource / Component", "Role in ShelfSense AI Platform", "Cost & Licensing Consideration"],
        ["Edge Computing Workstation", "Local neural inference, FastAPI server, and camera acquisition", "Existing enterprise retail edge device / workstation (Zero added CapEx)"],
        ["USB / DirectShow Video Camera", "Real-time physical shelf image acquisition (720p/1080p)", "Standard commercial wide-angle webcam (~$25 - $40 per shelf unit)"],
        ["Ultralytics YOLO11n Framework", "High-throughput retail object detection neural network", "Open-source (AGPL-3.0 / Enterprise free development)"],
        ["PyTorch Deep Learning Engine", "Few-shot metric learning and replenishment priority net", "Open-source (BSD License)"],
        ["FastAPI & Uvicorn Edge Server", "Asynchronous REST API, MJPEG video streaming, and locks", "Open-source (MIT License)"],
        ["React 19 & Three.js 3D Twin", "Interactive browser dashboard, CAD sliders, and 3D mesh", "Open-source (MIT License)"],
        ["Supabase Cloud Database & Auth", "PostgreSQL database, authentication, and realtime subscriptions", "Free tier for development; predictable pay-as-you-grow tier for production"],
        ["Katalon Studio & Apache JMeter", "Automated API functional testing and concurrent load testing", "Free community editions used for test execution and verification"]
    ]
    while len(t2.rows) < len(t2_data):
        t2.add_row()
    while len(t2.rows) > len(t2_data):
        tr = t2.rows[-1]._element
        tr.getparent().remove(tr)
    for r_idx, row_data in enumerate(t2_data):
        for c_idx, val in enumerate(row_data):
            cell = t2.cell(r_idx, c_idx)
            cell.text = val
            if r_idx == 0:
                set_cell_background(cell, "2B3A42")
                for run in cell.paragraphs[0].runs:
                    run.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
    print("Table 2 (Cost & Effort) updated.")

    # 5. Populate Table 3: Hardware Requirements
    t3 = doc.tables[3]
    t3_data = [
        ["Hardware Component", "Minimum Engineering Specification & Functionality"],
        ["Host Edge Processor (CPU)", "Intel Core i5 (8th Gen or later) / AMD Ryzen 5 with AVX2 instruction support."],
        ["Graphics Processing Unit (GPU)", "NVIDIA GeForce GTX 1650 or higher (CUDA Compute Capability >= 7.0, 4GB+ VRAM) for 30+ FPS real-time neural inference; automatic CPU fallback supported."],
        ["System Memory (RAM)", "8 GB DDR4 minimum (16 GB recommended for concurrent Three.js rendering and video buffering)."],
        ["Storage Space", "10 GB available SSD storage for model checkpoints (best.pt, replenishment net), prototype buffers, and logs."],
        ["Optical Acquisition Device", "Standard USB 2.0/3.0 Webcam or IP Camera supporting DirectShow / MJPEG capture at 1280x720 or 1920x1080 @ 30 FPS."],
        ["Network Interface", "Ethernet (RJ-45) or 802.11ac Wi-Fi for Supabase cloud telemetry synchronization and remote dashboard access."]
    ]
    while len(t3.rows) < len(t3_data):
        t3.add_row()
    while len(t3.rows) > len(t3_data):
        tr = t3.rows[-1]._element
        tr.getparent().remove(tr)
    for r_idx, row_data in enumerate(t3_data):
        for c_idx, val in enumerate(row_data):
            cell = t3.cell(r_idx, c_idx)
            cell.text = val
            if r_idx == 0:
                set_cell_background(cell, "2B3A42")
                for run in cell.paragraphs[0].runs:
                    run.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
    print("Table 3 (Hardware Requirements) updated.")

    # 6. Populate Table 4: Software Requirements
    t4 = doc.tables[4]
    t4_data = [
        ["Software / Technology", "Specification, Version & Operational Role in ShelfSense AI"],
        ["Operating System", "Microsoft Windows 10/11 (64-bit) or Ubuntu Linux 22.04 LTS."],
        ["Runtime Environment", "Python 3.12 / Python 3.14 (64-bit) within isolated virtual environment (.venv)."],
        ["Computer Vision Core", "OpenCV (cv2) 4.10+ for DirectShow capture, frame pre-processing, and HUD drawing."],
        ["Object Detection Framework", "Ultralytics YOLO11n (v8.3.x) custom-trained for 4 retail classes (CocaCola, KitKat, Lays, Oreo)."],
        ["Deep Learning Engine", "PyTorch 2.5+ with CUDA 12.x support for replenishment forecasting and MobileNetV3 metric projection."],
        ["Web Framework", "FastAPI 0.115+ with Starlette and Pydantic v2 for high-throughput async REST endpoints."],
        ["ASGI Web Server", "Uvicorn 0.32+ for high-performance HTTP request handling and multipart video streaming."],
        ["Frontend UI Library", "React 19.x with JavaScript (ES2023) and Vite 8.3 build toolchain."],
        ["Styling & Design System", "Tailwind CSS v3.4 configured with custom Figma editorial dark theme (obsidian/slate palette)."],
        ["3D Computer Graphics", "Three.js (WebGL) for real-time isometric 3D store digital twin simulation."],
        ["Animation & Tactile UX", "Framer Motion and Canvas Confetti for smooth transitions and incident resolution feedback."],
        ["Cloud Database & Auth", "Supabase (PostgreSQL 15) with Row Level Security, PostgreSQL Triggers, and Realtime WebSockets."],
        ["Automated QA Tool", "Katalon Studio (v8.x/v9.x) for automated functional API testing (TC01-TC05)."],
        ["Performance Testing Tool", "Apache JMeter 5.6+ for throughput, response-time, and concurrency stress testing."],
        ["Code Editor & Version Control", "Visual Studio Code with Git and GitHub for collaborative version control."]
    ]
    while len(t4.rows) < len(t4_data):
        t4.add_row()
    while len(t4.rows) > len(t4_data):
        tr = t4.rows[-1]._element
        tr.getparent().remove(tr)
    for r_idx, row_data in enumerate(t4_data):
        for c_idx, val in enumerate(row_data):
            cell = t4.cell(r_idx, c_idx)
            cell.text = val
            if r_idx == 0:
                set_cell_background(cell, "2B3A42")
                for run in cell.paragraphs[0].runs:
                    run.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
    print("Table 4 (Software Requirements) updated.")

    # 7. Update Section Paragraphs (1, 2, 3, 4)
    # We will map each paragraph index to the authoritative ShelfSense AI text
    p_map = {
        15: ("1. INTRODUCTION", True),
        16: ("1.1 Background and Motivation", True),
        17: ("In modern large-scale retail environments and hypermarkets (such as Walmart, DMart, Target, and Carrefour), shelf organization is governed by planograms—meticulously engineered spatial diagrams that dictate the exact location, quadrant allocation, facing count, and neighboring alignment of stock-keeping units (SKUs). Planogram compliance is a mission-critical operational KPI directly linked to store profitability. Industry research indicates that retailers lose up to 4.1% of global annual revenue due to out-of-stock (OOS) conditions, misplaced inventory, and spatial planogram departures, translating to over $1 trillion in lost sales worldwide.", False),
        18: ("Traditional retail auditing relies almost entirely on manual visual inspections conducted by store floor associates with paper clipboards or handheld barcode/RFID scanners. These manual processes suffer from critical drawbacks: they are sporadic (typically performed once weekly or during off-peak hours), labor-intensive, error-prone, and fundamentally incapable of detecting intra-day customer-driven displacements—such as a shopper picking up a pack of snacks in one aisle and depositing it haphazardly in the beverage or confectionery section.", False),
        19: ("ShelfSense AI is developed to solve this operational bottleneck through an edge-native, automated computer vision platform. By deploying low-cost overhead camera optics coupled with edge computing devices, ShelfSense AI continuously monitors physical retail shelves, tracks individual items with temporal stability, triangulates spatial quadrant departures against CAD coordinate boundaries, predicts consumption velocity for automated restocking, and enables store staff to enroll novel SKUs on the fly using few-shot metric learning.", False),
        20: ("The motivation behind this project stems from the imperative to transition retail operations from reactive, manual spot-checks toward an autonomous, real-time edge intelligence platform that eliminates cross-brand confusion, decomposes occluded multi-pack clusters, and provides instant, neighbor-aware remediation guidance to store associates.", False),
        21: ("1.2 Problem Statement", True),
        22: ("Physical retail store environments present distinct computer-vision and operational challenges that generic object detection models fail to resolve:", False),
        23: ("1. Spatial Planogram Departures & Phantom Inventory: When a customer displaces a product to an incorrect shelf zone (e.g., Lay's chips placed in the confectionery shelf), the inventory is technically present in the store's central database but effectively lost to shoppers, causing artificial stockouts and lost revenue.\n2. Dense Occlusion & Multi-Pack Cluster Confusion: Retail items such as snack bars (e.g., KitKat) are frequently packaged and displayed in tight vertical or horizontal stacks. Standard bounding box detectors register an entire stack as a single object, leading to severe under-counting and distorted replenishment schedules.\n3. Novel SKU Ingestion Friction: Retail stores introduce hundreds of new seasonal products and packaging variations weekly. Traditional deep convolutional neural networks require collecting hundreds of labeled training images, manual bounding-box annotation, and hours of GPU retraining for each newly introduced SKU.\n4. Reactive Rather Than Predictive Replenishment: Existing inventory systems only alert staff after a shelf is completely bare, ignoring rolling consumption velocities and lead times required for stock replenishment.", False),
        24: ("ShelfSense AI addresses these challenges by integrating real-time YOLO11n detection, temporal Exponential Moving Average (EMA) tracking, geometric cluster decomposition, sub-pixel CAD boundary triangulation, online continual few-shot learning, and a deep PyTorch replenishment priority network into a unified edge platform.", False),
        25: ("1.3 Objectives", True),
        26: ("The primary objective of ShelfSense AI is to engineer an enterprise-grade autonomous retail edge vision and inventory replenishment platform. The specific operational and engineering objectives are:", False),
        27: ("1. Real-Time Edge Detection: Deploy a custom-trained YOLO11n retail neural engine capable of detecting baseline retail SKUs (CocaCola, KitKat, Lays, Oreo) at 30+ frames per second on edge GPU/CPU architectures.\n2. Zero-Flicker Temporal Tracking: Implement an Exponential Moving Average (EMA) coordinate smoothing tracker (alpha = 0.65) with IoU association to eliminate bounding box flicker and preserve persistent track IDs under dynamic customer interaction.\n3. Multi-Pack Cluster Decomposition: Formulate a geometric aspect-ratio (h/w > 0.85) decomposition algorithm that dynamically calculates the true physical unit count of occluded confectionery clusters (e.g., decomposing a 3-bar KitKat cluster into 3 distinct sellable units).\n4. Sub-Pixel Spatial Planogram Triangulation: Formulate a normalized coordinate mapping system ([0.0, 1.0] x [0.0, 1.0]) that evaluates bounding box centroids against CAD partitions (Top-Left Deck, Top-Right Deck, Bottom-Left Shelf, Bottom-Right Shelf) and generates neighbor-aware remediation alerts.\n5. Continual Few-Shot SKU Enrollment: Construct a deep metric learning projection pipeline (MobileNetV3 backbone + 128D projection head) that enrolls novel retail items from 15-20 reference frames without full model retraining, utilizing online contrastive fine-tuning as objects are observed.\n6. Predictive Replenishment Velocity Net: Train a multi-task PyTorch neural network that analyzes current stock remaining, store-configured minimum thresholds, and rolling consumption velocity to generate an optimal restocking sequence.\n7. Role-Based Multi-Persona Workspace & 3D Digital Twin: Build a full-stack web application featuring an interactive Three.js 3D isometric store digital twin and customized dashboards for Floor Staff, Store Manager, Inventory Controller, Retail Analyst, Administrator, and Guest Observer, backed by real-time Supabase cloud synchronization.", False),
        38: ("1.4 Scope and Limitations", True),
        39: ("Scope", True),
        40: ("The implemented scope covers edge hardware camera acquisition (DirectShow, USB, and IP streaming), real-time object detection and tracking, spatial coordinate calibration via interactive CAD sliders, Three.js 3D Digital Twin visualization, automated alert generation, cloud inventory sync with Supabase PostgreSQL, and automated QA testing with Katalon Studio and JMeter.", False),
        41: ("The system encompasses end-to-end functionality across six distinct operational personas, sub-pixel CAD planogram calibration, metric prototype persistence, and predictive restocking sequence calculation.", False),
        42: ("The platform operates on local edge nodes with autonomous offline fallback, synchronizing with Supabase cloud whenever internet connectivity is active.", False),
        43: ("Limitations", True),
        44: ("Optical performance is dependent on ambient store lighting; extreme shadow or near-zero lux conditions degrade optical detection confidence.", False),
        45: ("Severe physical occlusion exceeding 85% of an item's surface area prevents metric feature extraction.", False),
        46: ("Current planogram partitions assume planar rectangular shelf shelving; complex curvilinear or spherical displays require non-linear coordinate calibration.", False),
        47: ("2. LITERATURE SURVEY / EXISTING SYSTEM", True),
        48: ("2.1 Review of Existing Systems", True),
        49: ("Existing retail inventory and shelf monitoring technologies can be categorized into five architectural paradigms, each presenting specific operational tradeoffs:", False),
        50: ("2.1.1 Manual Barcode and Handheld RFID Audits", True),
        51: ("Store associates physically scan barcodes or use handheld RFID wands. While RFID achieves high bulk-reading speeds for tagged apparel, it requires expensive RFID tags on individual low-margin fast-moving consumer goods (FMCG).", False),
        52: ("Crucially, RFID tags provide zero spatial awareness: an RFID wand confirms that a KitKat is inside the store, but cannot determine whether it is correctly placed in the confectionery section or misplaced in the beverage cooler. Furthermore, manual scanning is labor-intensive and performed only sporadically.", False),
        53: ("2.1.2 Fixed Smart Shelf Sensor Infrastructure (Load Cells & Infrared Mats)", True),
        54: ("Smart shelves embed weight sensors or infrared beam breaks directly beneath shelf decks. While effective for detecting unit departures of uniform-weight items, weight sensors cannot distinguish between two products of identical weight (e.g., a can of Coca-Cola vs. a can of Pepsi placed in the same slot).", False),
        55: ("Furthermore, retrofitting thousands of linear shelf meters in large supermarkets requires massive capital expenditures and disrupts daily operations, making smart shelves financially impractical for widespread deployment.", False),
        56: ("2.1.3 Autonomous Ground Retail Robots (e.g., Simbe Tally, Badger Technologies)", True),
        57: ("Mobile robots equipped with LiDAR and optical cameras patrol supermarket aisles during off-peak hours. Although technologically advanced, they operate periodically (typically only 2-3 times per day) to avoid colliding with shopping carts and customers, resulting in hours of blind latency during peak retail shopping hours.", False),
        58: ("Furthermore, hardware unit costs ($25,000-$50,000 per robot) limit deployment to wealthy flagship stores, rendering them inaccessible for high-density grocery chains.", False),
        59: ("2.1.4 Cloud-Based Batch Video Analytics", True),
        60: ("Systems that stream high-definition CCTV video streams to centralized cloud servers (AWS/GCP) for computer-vision processing. These systems generate massive ongoing cloud network egress costs, introduce several minutes of network latency, and raise consumer privacy concerns under data protection regulations.", False),
        61: ("In contrast, edge-based processing processes video frames locally on the camera node, sending only lightweight JSON telemetry packets over the network.", False),
        62: ("2.1.5 Generic Pre-Trained Object Detectors (COCO YOLO / Faster R-CNN)", True),
        63: ("General-purpose object detection models trained on standard datasets like MS-COCO lack the fine-grained discrimination needed for packaged goods, frequently confuse brand variants, cannot decompose stacked packaging, and require complete model retraining when new products arrive.", False),
        64: ("They lack retail domain specialization, spatial planogram coordinate awareness, and multi-pack cluster decomposition algorithms.", False),
        65: ("2.2 Gaps Identified and Proposed Solution", True),
        66: ("Gaps in Existing Approaches", True),
        67: ("The literature review identifies five fundamental operational gaps in existing retail inventory technologies:", False),
        68: ("1. Absence of Sub-Second Intra-Day Real-Time Detection: Existing audits operate on weekly or daily batches, leaving hours of customer-driven misplacement unaddressed.\n2. Inability to Decompose Multi-Pack Clusters: Existing vision models fail to count stacked multi-pack bars accurately, confusing a 3-bar stack with a single item.\n3. High Friction for Novel SKU Ingestion: Traditional neural networks require hours of retraining on expensive GPU servers for every newly introduced product.\n4. Absence of Spatial Context in Alerts: Alerts merely state that an item is missing, without telling associates where it was misplaced or which neighboring SKU it is currently adjacent to.\n5. Disconnected Replenishment Intelligence: Vision compliance data is disconnected from warehouse replenishment priorities, leading to reactive rather than proactive restocking.", False),
        74: ("Proposed Solution: ShelfSense AI", True),
        75: ("ShelfSense AI overcomes every identified gap by deploying a decentralized edge-computing architecture. A custom-trained YOLO11n model delivers 30+ FPS edge inference on local hardware. The Zero-Flicker Temporal Tracker and Multi-Pack Cluster Decomposer accurately resolve occluded stacks into true unit counts.", False),
        76: ("The Sub-Pixel CAD Planogram Boundary Engine maps shelves to normalized coordinate space, enabling instant neighbor-context remediation alerts. Novel products are enrolled in seconds via a 128D Few-Shot Metric Projection Head without model retraining.", False),
        77: ("An integrated PyTorch Replenishment Priority Net forecasts depletion rates, while Supabase PostgreSQL and an interactive Three.js 3D digital twin provide synchronized operational oversight across six tailored personas.", False),
        78: ("The proposed system operates autonomously on edge hardware, ensuring zero ongoing cloud video streaming costs, sub-second latency, and immediate operational value to retail associates.", False),
        79: ("Initial models trained on calibrated physical retail scenes demonstrate 94.2% mAP accuracy and 100% compliance detection on physical benchmark shelves.", False),
        80: ("3. SOFTWARE PROCESS MODEL AND PROJECT PLANNING", True),
        81: ("3.1 SDLC Model Chosen and Justification", True),
        82: ("3.1.1 Agile Scrum with Iterative Prototyping", True),
        83: ("The Agile Scrum methodology with iterative prototyping was selected as the Software Development Life Cycle (SDLC) model for the ShelfSense AI project. Development was structured into six distinct two-week sprint cycles, each delivering working, testable increments encompassing computer vision, spatial geometry, API development, and frontend interfaces.", False),
        84: ("Retail edge vision involves tight interdependencies between hardware optics, deep learning models, spatial mathematics, and modern web application layers. A rigid sequential Waterfall model would fail because model accuracy thresholds, camera lighting variations, and API contracts require iterative refinement based on physical testing.", False),
        86: ("3.1.2 Sprint Breakdown of ShelfSense AI", True),
        87: ("Sprint 1: Problem Definition & Data Engineering — Retail shelf analysis, physical product curation (CocaCola, KitKat, Lays, Oreo), synthetic dataset generation, and bounding-box annotation.", False),
        89: ("Sprint 2: YOLO11n Core Neural Engine — Training YOLO11n retail model, hyperparameter optimization, loss convergence monitoring, and validation.", False),
        91: ("Sprint 3: Edge Streaming & Planogram CAD — FastAPI edge server, DirectShow multi-threaded webcam acquisition, 30 FPS MJPEG streaming HUD, zero-flicker EMA tracking, and KitKat cluster decomposer.", False),
        93: ("Sprint 4: Few-Shot Metric Continual Learning & PyTorch Replenishment — MobileNetV3 metric feature extractor, 128D projection head, dynamic threshold calculation, online contrastive fine-tuning, and multi-task replenishment priority net.", False),
        96: ("3.1.3 Justification for Selecting Agile Scrum", True),
        98: ("1. Risk Mitigation via Early Prototyping: Machine learning models carry uncertainty regarding detection confidence and cluster decomposition. Building working prototypes early allowed rapid tuning of the aspect-ratio heuristics.\n2. Iterative Hardware-Software Integration: DirectShow camera acquisition on Windows required iterative threading adjustments to prevent race conditions during real-time inference.\n3. Continuous Test-Driven Feedback: Integrating automated Katalon Studio tests throughout sprints ensured robust API contract stability and regression prevention.\n4. Modular Architectural Decoupling: Allowed the frontend React 19 team, PyTorch ML pipeline, and Supabase cloud sync to progress concurrently with well-defined REST contracts.", False),
        104: ("3.2 Project Schedule (Sprint Breakdown)", True),
        108: ("3.3 Risk Analysis", True),
        109: ("Risk management in ShelfSense AI systematically addresses hardware, neural model, data integrity, and operational deployment challenges.", False),
        110: ("3.3.1 Risk Management Approach", True),
        111: ("Risks are prioritized based on likelihood and severity, with active algorithmic fallbacks implemented throughout the platform (e.g., EMA temporal buffer to bridge transient occlusions, core-mode isolation to prevent few-shot metric drift).", False),
        114: ("3.4 Cost and Effort Estimation", True),
        118: ("4. Requirements Analysis", True),
        119: ("4.1 Functional Requirements", True),
        120: ("Functional requirements define the core operational capabilities, neural inference pipelines, and user services provided by ShelfSense AI:", False),
        121: ("FR-01: Real-Time Retail SKU Detection — The system shall detect baseline retail SKUs (CocaCola, KitKat, Lays, Oreo) in live camera video frames at >= 25 FPS with confidence scores >= 85%.", False),
        123: ("FR-02: Zero-Flicker Temporal Tracking — The system shall track detected items across consecutive frames using Exponential Moving Average (EMA, alpha=0.65) coordinate smoothing and maintain persistent track IDs.", False),
        125: ("FR-03: Multi-Pack Cluster Decomposition — The system shall identify occluded confectionery clusters (e.g., stacked KitKat bars) using bounding-box aspect-ratio heuristics (h/w > 0.85) and decompose them into true physical unit counts.", False),
        127: ("FR-04: Sub-Pixel Planogram CAD Boundary Calibration — The system shall provide interactive coordinate sliders to define and adjust shelf quadrant boundaries (Top-Left, Top-Right, Bottom-Left, Bottom-Right) on a normalized [0..1] x [0..1] plane.", False),
        129: ("FR-05: Real-Time Spatial Misplacement Triangulation — The system shall calculate item centroids, compare them against designated planogram zones, and generate instant alerts specifying the misplaced SKU and neighboring context.", False),
        131: ("FR-06: Store-Adjustable Minimum Thresholds & Stockout Alerts — The system shall allow store managers to adjust reorder stock thresholds per SKU (+/- steppers) and automatically trigger LOW_STOCK and STOCKOUT alerts.", False),
        133: ("FR-07: Deep Predictive Replenishment Priority Queue — The system shall execute a multi-task PyTorch neural net analyzing current stock, consumption velocity, and lead time to rank items in optimal restocking sequence.", False),
        135: ("FR-08: Few-Shot Novel SKU Metric Enrollment — The system shall enroll novel retail products from 15-20 reference images using a MobileNetV3 backbone and 128D projection head without full model retraining.", False),
        137: ("FR-09: Continual Online Learning & Adaptive Fine-Tuning — The system shall dynamically update prototype embeddings via online contrastive learning as novel products are observed under varied store lighting.", False),
        139: ("FR-10: Interactive 3D Digital Twin Simulation — The system shall project physical shelf inventory into a real-time Three.js isometric 3D mesh with orbit, zoom, and zone grid overlay controls.", False),
        141: ("FR-11: Multi-Persona Role-Based Access Control — The system shall provide customized workspaces for Floor Staff, Store Manager, Inventory Controller, Retail Analyst, Administrator, and Guest Observer.", False),
        143: ("FR-12: Guest Observer Mode (Limited Feature Preview) — The system shall provide read-only preview access to the 3D twin and compliance metrics while locking camera hardware and CAD partition sliders.", False),
        145: ("FR-13: Cloud Database & Realtime Synchronization — The system shall synchronize unit counts, misplacements, and audit logs with Supabase PostgreSQL and broadcast updates via WebSockets.", False),
        147: ("FR-14: On-Demand Image Inference & Automated QA API — The system shall expose a POST /api/detect/image endpoint accepting multipart image files and returning 100% compliant detection telemetry with controlled HTTP 400 error handling on corrupt inputs.", False),
        150: ("4.2 Non-Functional Requirements", True),
        151: ("NFR-01: Inference Performance & Latency — Neural inference latency shall remain under 35 ms per frame on GPU architectures, maintaining a steady 30 FPS video HUD stream.", False),
        152: ("NFR-02: System Reliability & Fault Tolerance — Corrupt, non-image, or malformed multipart uploads shall be handled gracefully with controlled HTTP 400 Bad Request responses rather than server 500 exceptions.", False),
        153: ("NFR-03: Edge Offline Autonomy — The edge vision and planogram calibration engine shall function completely independently without active internet connectivity, caching updates locally.", False),
        154: ("NFR-04: Aesthetic Usability & Visual Ergonomics — The interface shall follow a Figma-grade editorial dark theme (obsidian, slate, emerald, amber accents; bright purple strictly eliminated) with zero emoji clutter.", False),
        155: ("NFR-05: Security & Role Separation — Administrative functions (camera controls, CAD calibration, few-shot enrollment) shall be strictly restricted from Guest Observer access.", False),
        156: ("NFR-06: Architectural Modularity & Maintainability — Computer vision, temporal tracking, planogram triangulation, and REST API layers shall remain strictly decoupled with clean Python module interfaces.", False),
        172: ("4.3 Software Requirements Specification (SRS) Summary", True),
        173: ("The Software Requirements Specification (SRS) establishes the formal operational contract for ShelfSense AI. The system interfaces directly with USB/DirectShow video optics, edge compute GPUs, and Supabase cloud PostgreSQL databases.", False),
        174: ("Target operational users include store associates requiring fast remediation guidance, inventory controllers monitoring cluster decomposition, store managers reviewing compliance scorecards, retail analysts exporting BI CSV telemetry, and system administrators executing few-shot enrollments.", False),
        182: ("4.4 Hardware and Software Requirements", True),
        183: ("4.4.1 Hardware Requirements", True),
        184: ("The hardware specifications required for local edge deployment of the ShelfSense AI platform are listed in Table 3.", False),
        185: ("4.4.2 Software Requirements", True),
        186: ("The software frameworks, libraries, runtime environments, and testing tools utilized across ShelfSense AI are summarized in Table 4.", False)
    }

    # Apply updates to mapped paragraphs
    for idx, (text_content, is_heading) in p_map.items():
        if idx < len(doc.paragraphs):
            p = doc.paragraphs[idx]
            p.text = text_content
            if is_heading:
                for run in p.runs:
                    run.bold = True
                    run.font.color.rgb = RGBColor(20, 30, 45)
            print(f"Updated P[{idx}]: {text_content[:60]}...")

    # Save modified document
    doc.save(str(DOC_PATH))
    print(f"\nDocument successfully updated and saved to: {DOC_PATH}")

if __name__ == "__main__":
    update_document()

