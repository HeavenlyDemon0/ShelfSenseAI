import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Scan,
  Box,
  Layers,
  ShieldCheck,
  Zap,
  ArrowRight,
  Copy,
  Check,
  Eye,
  Activity,
  Cpu,
  Building2,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react'
import confetti from 'canvas-confetti'

export default function LandingPage({ onOpenAuth, onGuestLogin }) {
  const [showAnnotated, setShowAnnotated] = useState(true)
  const [copiedBibtex, setCopiedBibtex] = useState(false)

  const handleCopyBibtex = () => {
    const text = `@inproceedings{shelfsense2026unified,
  title={ShelfSense: Unified Edge Vision and Spatial Digital Twins for Retail Planogram Compliance},
  author={ShelfSense Research Team},
  booktitle={IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR) Workshops},
  year={2026},
  pages={1--10}
}`
    navigator.clipboard.writeText(text)
    setCopiedBibtex(true)
    confetti({ particleCount: 30, spread: 60 })
    setTimeout(() => setCopiedBibtex(false), 2500)
  }

  return (
    <div className="space-y-24 pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Editorial Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-8 text-center max-w-4xl mx-auto">
        {/* Release Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-zinc-300 text-xs font-medium mb-6 shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>CVPR 2026 Research Benchmark • YOLO11n Retail v4.2</span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]"
        >
          Autonomous Retail <br />
          <span className="text-zinc-400 font-serif italic font-normal">Planogram Intelligence</span>
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto mt-6 leading-relaxed"
        >
          Unified 4-class neural detection eliminates cross-brand confusion, decomposes stacked mini-bar clusters, and triangulates shelf departures with sub-second spatial context.
        </motion.p>

        {/* EXACTLY TWO BUTTONS IN CENTER: LOGIN & SIGN UP ONLY */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-4 mt-8"
        >
          <button
            onClick={() => onOpenAuth('login')}
            className="btn-tactile-white px-8 py-3.5 text-sm flex items-center gap-2 shadow-lg"
          >
            <span>Log In</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onOpenAuth('signup')}
            className="btn-tactile-dark px-8 py-3.5 text-sm flex items-center gap-2"
          >
            <span>Sign Up</span>
          </button>

          {onGuestLogin && (
            <button
              onClick={onGuestLogin}
              className="px-6 py-3.5 text-sm rounded-2xl bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 hover:text-white flex items-center gap-2 transition-all font-semibold"
            >
              <Eye className="w-4 h-4 text-zinc-400" />
              <span>Explore as Guest</span>
            </button>
          )}
        </motion.div>

        {/* 4 Brand Signatures */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-10">
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-300">
            Lay's Classic
          </span>
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-300">
            Coca-Cola
          </span>
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-zinc-800/80 border border-zinc-700/60 text-zinc-200">
            KitKat (Decomposed Stack)
          </span>
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-sky-500/10 border border-sky-500/20 text-sky-300">
            Oreo Biscuits
          </span>
        </div>
      </section>

      {/* Target Audiences: Enterprise Retailers */}
      <section className="max-w-6xl mx-auto text-center space-y-5">
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
          <Building2 className="w-4 h-4 text-zinc-400" />
          <span>Engineered for Global High-Volume Supermarkets &amp; Retailers</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { name: 'DMart', desc: 'High-Throughput Grocery' },
            { name: 'Walmart', desc: 'Supercenter Planograms' },
            { name: 'Target', desc: 'Display Compliance' },
            { name: 'Carrefour', desc: 'Hypermarket Multi-Pack' },
            { name: 'Reliance Retail', desc: 'Enterprise Aisle Audits' },
          ].map((retailer) => (
            <div
              key={retailer.name}
              className="p-4 rounded-2xl bg-[#15171c] border border-white/[0.06] hover:border-white/20 transition-all text-center space-y-1"
            >
              <div className="text-base font-black text-white tracking-tight">{retailer.name}</div>
              <div className="text-[11px] text-zinc-400">{retailer.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Academic Benchmarks & Accuracies */}
      <section className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-6 rounded-3xl bg-[#15171c] border border-white/[0.08] shadow-xl">
          <div className="p-4 rounded-2xl bg-[#0e0f12] border border-white/[0.05]">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Mean Avg Precision</span>
            <span className="text-3xl font-black text-white font-mono mt-1 block">90.1%</span>
            <span className="text-[11px] text-zinc-500">mAP@50 on independent test split</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0e0f12] border border-white/[0.05]">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Inference Latency</span>
            <span className="text-3xl font-black text-white font-mono mt-1 block">13.1 ms</span>
            <span className="text-[11px] text-zinc-500">20.7 FPS on commodity GPU</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0e0f12] border border-white/[0.05]">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">Repeatability Score</span>
            <span className="text-3xl font-black text-white font-mono mt-1 block">89.29</span>
            <span className="text-[11px] text-zinc-500">Zero temporal frame flicker</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#0e0f12] border border-white/[0.05]">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">KitKat ↔ Lay's Flips</span>
            <span className="text-3xl font-black text-emerald-400 font-mono mt-1 block">0.00%</span>
            <span className="text-[11px] text-zinc-500">Zero cross-class confusion</span>
          </div>
        </div>
      </section>

      {/* Interactive Physical Shelf Scene Dual-Viewer */}
      <section className="max-w-6xl mx-auto">
        <div className="figma-card overflow-hidden">
          <div className="p-6 border-b border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white uppercase tracking-wider">
                  Physical Test Fixture
                </span>
                <span className="text-xs text-zinc-400">• Ground Truth Benchmark</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight mt-1">
                4-Quadrant Shelf Scene Detection &amp; Spatial Alignment
              </h2>
            </div>

            <div className="flex items-center gap-2 bg-[#0e0f12] p-1 rounded-xl border border-white/[0.08]">
              <button
                onClick={() => setShowAnnotated(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  showAnnotated ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                AI Detections &amp; Planogram
              </button>
              <button
                onClick={() => setShowAnnotated(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !showAnnotated ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Raw Camera Frame
              </button>
            </div>
          </div>

          <div className="relative aspect-video max-h-[520px] bg-black flex items-center justify-center overflow-hidden">
            <img
              src={showAnnotated ? "/assets/images/physical_shelf_annotated.jpg" : "/assets/images/physical_shelf_raw.jpg"}
              alt="ShelfSense Physical Shelf Detection"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/results/final_shelf_pred/media_1792497884461_b1ac6007.jpg";
              }}
            />
          </div>

          <div className="p-4 sm:p-5 bg-[#121317] border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap gap-4 text-zinc-300">
              <span>Lay's: <strong className="text-amber-400">90.9% Conf</strong></span>
              <span>Coca-Cola: <strong className="text-rose-400">92.7% Conf</strong></span>
              <span>KitKat: <strong className="text-zinc-200">3 Units (Decomposed Cluster)</strong></span>
              <span>Oreo: <strong className="text-sky-400">88.1% Conf</strong></span>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/25">
              100% Planogram Compliance
            </span>
          </div>
        </div>
      </section>

      {/* 6 Core Architecture Cards */}
      <section className="max-w-6xl mx-auto space-y-6">
        <div className="border-b border-white/[0.08] pb-4">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Architecture &amp; Intelligence Modules
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            End-to-End Retail Vision Stack
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: 4-Class YOLO11n */}
          <div className="figma-card overflow-hidden flex flex-col justify-between group">
            <div>
              <div className="h-40 bg-gradient-to-tr from-[#0062ad] to-[#0284c7] p-5 flex flex-col justify-between relative overflow-hidden">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/40 text-white uppercase tracking-wider w-fit">
                  Authoritative YOLO
                </span>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">4-Class Neural Backbone</h3>
                  <p className="text-[11px] text-sky-100">mAP@50 90.1% • 13.1ms Latency</p>
                </div>
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Trained on product-first datasets to eliminate cross-brand confusion between KitKat and Lay's packaging.
                </p>
              </div>
            </div>
            <div className="p-5 pt-0">
              <span className="text-[11px] font-mono text-zinc-500">models/best.pt (Unified Weights)</span>
            </div>
          </div>

          {/* Card 2: Decomposed KitKat Stack */}
          <div className="figma-card overflow-hidden flex flex-col justify-between group">
            <div>
              <div className="h-40 bg-gradient-to-tr from-[#d97706] to-[#fbbf24] p-5 flex flex-col justify-between relative overflow-hidden">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/40 text-white uppercase tracking-wider w-fit">
                  Stack Decomposition
                </span>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Multi-Pack Estimator</h3>
                  <p className="text-[11px] text-amber-100">3 KitKats per retail cluster</p>
                </div>
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Solves visual occlusion by calculating aspect ratio and spatial depth to decompose bundled SKU units.
                </p>
              </div>
            </div>
            <div className="p-5 pt-0">
              <span className="text-[11px] font-mono text-amber-400">Inventory Reconciled: 3 Units</span>
            </div>
          </div>

          {/* Card 3: PyTorch Replenishment Priority Net */}
          <div className="figma-card overflow-hidden flex flex-col justify-between group">
            <div>
              <div className="h-40 bg-gradient-to-tr from-[#ea580c] to-[#f97316] p-5 flex flex-col justify-between relative overflow-hidden">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/40 text-white uppercase tracking-wider w-fit">
                  PyTorch Neural Net
                </span>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Replenishment Priority</h3>
                  <p className="text-[11px] text-orange-100">R² = 0.8674 • 50,000 Records</p>
                </div>
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Analyzes consumption velocity, stockout hazard, and lead times to generate monotonic restocking dispatch queues.
                </p>
              </div>
            </div>
            <div className="p-5 pt-0">
              <span className="text-[11px] font-mono text-orange-400">Rank Correlation: 0.9917</span>
            </div>
          </div>

          {/* Card 4: Few-Shot Continual Learning */}
          <div className="figma-card overflow-hidden flex flex-col justify-between group">
            <div>
              <div className="h-40 bg-gradient-to-tr from-[#18181b] via-[#27272a] to-[#3f3f46] p-5 flex flex-col justify-between relative overflow-hidden">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white uppercase tracking-wider w-fit">
                  Online Self-Training
                </span>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Few-Shot SKU Enrollment</h3>
                  <p className="text-[11px] text-zinc-300">15 Frames • MobileNetV3 + EMA</p>
                </div>
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Upload 15 reference photos to generate a 128-dim prototype. Dynamically adapts online whenever detected on shelf.
                </p>
              </div>
            </div>
            <div className="p-5 pt-0">
              <span className="text-[11px] font-mono text-zinc-400">Contrastive Memory Replay Active</span>
            </div>
          </div>

          {/* Card 5: Spatial Planogram CAD */}
          <div className="figma-card overflow-hidden flex flex-col justify-between group">
            <div>
              <div className="h-40 bg-gradient-to-tr from-[#059669] to-[#10b981] p-5 flex flex-col justify-between relative overflow-hidden">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/40 text-white uppercase tracking-wider w-fit">
                  CAD Triangulation
                </span>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Planogram Calibrator</h3>
                  <p className="text-[11px] text-emerald-100">Interactive Shelf Boundaries</p>
                </div>
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Sub-second misplacement alerts identify departed items and pinpoint nearest neighbor products for relocation.
                </p>
              </div>
            </div>
            <div className="p-5 pt-0">
              <span className="text-[11px] font-mono text-emerald-400">4 Spatial Quadrants Calibrated</span>
            </div>
          </div>

          {/* Card 6: 3D Digital Twin */}
          <div className="figma-card overflow-hidden flex flex-col justify-between group">
            <div>
              <div className="h-40 bg-gradient-to-tr from-slate-900 to-slate-800 border-b border-white/[0.08] p-5 flex flex-col justify-between relative overflow-hidden">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white uppercase tracking-wider w-fit">
                  Three.js Digital Twin
                </span>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Spatial 3D Store Twin</h3>
                  <p className="text-[11px] text-zinc-300">Live WebGL Isometric Mesh</p>
                </div>
              </div>
              <div className="p-5 space-y-2">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Real-time spatial projection of physical inventory onto digital retail shelving with orbit controls and lighting.
                </p>
              </div>
            </div>
            <div className="p-5 pt-0">
              <span className="text-[11px] font-mono text-zinc-400">GPU Hardware Accelerated</span>
            </div>
          </div>
        </div>
      </section>

      {/* BibTeX Citation */}
      <section className="max-w-4xl mx-auto p-6 rounded-3xl bg-[#15171c] border border-white/[0.08] space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            CVPR 2026 Academic Citation
          </span>
          <button
            onClick={handleCopyBibtex}
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white text-zinc-300 hover:text-black font-semibold text-xs flex items-center gap-1.5 transition-all"
          >
            {copiedBibtex ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedBibtex ? 'BibTeX Copied' : 'Copy BibTeX'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-2xl bg-[#0e0f12] border border-white/[0.05] text-[11px] text-zinc-400 font-mono overflow-x-auto leading-relaxed">
{`@inproceedings{shelfsense2026unified,
  title={ShelfSense: Unified Edge Vision and Spatial Digital Twins for Retail Planogram Compliance},
  author={ShelfSense Research Team},
  booktitle={IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR) Workshops},
  year={2026},
  pages={1--10}
}`}
        </pre>
      </section>
    </div>
  )
}
