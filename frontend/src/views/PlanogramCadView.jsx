import React, { useState, useEffect } from 'react'
import {
  SlidersHorizontal,
  Download,
  RotateCcw,
  Check,
  Layers,
  Image as ImageIcon,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Save,
} from 'lucide-react'
import confetti from 'canvas-confetti'

export default function PlanogramCadView({ onApplied }) {
  const [zones, setZones] = useState({
    TOP_LEFT: { name: 'Top-Left Deck', sku: 'Lays', color: '#eab308', xSplit: 0.48, ySplit: 0.52 },
    TOP_RIGHT: { name: 'Top-Right Deck', sku: 'CocaCola', color: '#ef4444', xSplit: 0.48, ySplit: 0.52 },
    BOTTOM_LEFT: { name: 'Bottom-Left Shelf', sku: 'KitKat', color: '#d946ef', xSplit: 0.45, ySplit: 0.52 },
    BOTTOM_RIGHT: { name: 'Bottom-Right Shelf', sku: 'Oreo', color: '#38bdf8', xSplit: 0.45, ySplit: 0.52 },
  })

  const [ySplit, setYSplit] = useState(0.52)
  const [topXSplit, setTopXSplit] = useState(0.48)
  const [bottomXSplit, setBottomXSplit] = useState(0.45)
  const [boundaryPadding, setBoundaryPadding] = useState(0.02)
  const [showShelfPhoto, setShowShelfPhoto] = useState(true)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [calibrateSuccess, setCalibrateSuccess] = useState(false)
  const [simulatedMisplacement, setSimulatedMisplacement] = useState(null)

  // Fetch live zones from backend on mount
  useEffect(() => {
    fetch('/api/planogram/zones')
      .then((res) => res.json())
      .then((data) => {
        if (data?.zones) {
          const z = data.zones
          if (z.TOP_LEFT?.x_range) setTopXSplit(z.TOP_LEFT.x_range[1])
          if (z.BOTTOM_LEFT?.x_range) setBottomXSplit(z.BOTTOM_LEFT.x_range[1])
          if (z.TOP_LEFT?.y_range) setYSplit(z.TOP_LEFT.y_range[1])
        }
      })
      .catch((err) => console.log('Loaded local CAD defaults:', err))
  }, [])

  const handleApplyToBackend = async () => {
    setIsCalibrating(true)
    setCalibrateSuccess(false)

    const payload = {
      zones: {
        TOP_LEFT: {
          x_range: [0.0, topXSplit],
          y_range: [0.0, ySplit],
          name: zones.TOP_LEFT.name,
          designated_product: zones.TOP_LEFT.sku,
          color: zones.TOP_LEFT.color,
        },
        TOP_RIGHT: {
          x_range: [topXSplit, 1.0],
          y_range: [0.0, ySplit],
          name: zones.TOP_RIGHT.name,
          designated_product: zones.TOP_RIGHT.sku,
          color: zones.TOP_RIGHT.color,
        },
        BOTTOM_LEFT: {
          x_range: [0.0, bottomXSplit],
          y_range: [ySplit, 1.0],
          name: zones.BOTTOM_LEFT.name,
          designated_product: zones.BOTTOM_LEFT.sku,
          color: zones.BOTTOM_LEFT.color,
        },
        BOTTOM_RIGHT: {
          x_range: [bottomXSplit, 1.0],
          y_range: [ySplit, 1.0],
          name: zones.BOTTOM_RIGHT.name,
          designated_product: zones.BOTTOM_RIGHT.sku,
          color: zones.BOTTOM_RIGHT.color,
        },
      },
    }

    try {
      const res = await fetch('/api/planogram/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setCalibrateSuccess(true)
        confetti({ particleCount: 40, spread: 60 })
        if (onApplied) onApplied()
        setTimeout(() => setCalibrateSuccess(false), 3000)
      }
    } catch (err) {
      console.error('Calibration error:', err)
    } finally {
      setIsCalibrating(false)
    }
  }

  const handleExportJSON = () => {
    const payload = {
      version: '4.2.0',
      calibrated_at: new Date().toISOString(),
      partitions: {
        y_split: ySplit,
        top_deck_x_split: topXSplit,
        bottom_shelf_x_split: bottomXSplit,
        boundary_padding: boundaryPadding,
      },
      zones: {
        TOP_LEFT: { sku: zones.TOP_LEFT.sku, x_range: [0.0, topXSplit], y_range: [0.0, ySplit] },
        TOP_RIGHT: { sku: zones.TOP_RIGHT.sku, x_range: [topXSplit, 1.0], y_range: [0.0, ySplit] },
        BOTTOM_LEFT: { sku: zones.BOTTOM_LEFT.sku, x_range: [0.0, bottomXSplit], y_range: [ySplit, 1.0] },
        BOTTOM_RIGHT: { sku: zones.BOTTOM_RIGHT.sku, x_range: [bottomXSplit, 1.0], y_range: [ySplit, 1.0] },
      },
      multi_pack_decomposition: true,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shelfsense_planogram_schema.json`
    a.click()
    confetti({ particleCount: 30 })
  }

  const triggerMisplacementTest = (sku, actualZoneId) => {
    const targetZone = zones[actualZoneId]
    setSimulatedMisplacement({
      sku,
      actualZone: targetZone.name,
      neighborSku: targetZone.sku,
      expectedZone: 'Bottom-Left Shelf',
      message: `${sku} is misplaced! Placed in ${targetZone.name} (near ${targetZone.sku}) instead of Bottom-Left Shelf.`,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Planogram CAD Boundary Studio</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Sub-Pixel Coordinate Calibration & Live Sync
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            Calibrate physical shelf zone coordinate thresholds, designated quadrant SKUs, and sync directly to the live YOLO11n engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleApplyToBackend}
            disabled={isCalibrating}
            className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-lg flex items-center gap-1.5 transition-all ${
              calibrateSuccess
                ? 'bg-emerald-600 shadow-emerald-500/30'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/20'
            }`}
          >
            {calibrateSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{calibrateSuccess ? 'Applied to Live Engine!' : isCalibrating ? 'Applying...' : 'Apply to Live Engine'}</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs border border-white/10 flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Schema</span>
          </button>
        </div>
      </div>

      {/* Main CAD Workspace Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive 2D Calibration Visualizer */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-black border border-white/10 flex flex-col justify-between relative overflow-hidden min-h-[480px]">
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Underlay physical shelf photo if enabled */}
          {showShelfPhoto && (
            <div className="absolute inset-0 opacity-35 pointer-events-none overflow-hidden">
              <img
                src="/assets/images/physical_shelf_raw.jpg"
                alt="Physical Shelf Reference"
                className="w-full h-full object-cover filter brightness-90 contrast-110"
                onError={(e) => {
                  e.target.onerror = null
                  e.target.src = '/results/test_pred_media_1792497884461_b1ac6007.jpg'
                }}
              />
            </div>
          )}

          {/* Top Canvas Bar */}
          <div className="relative z-10 flex justify-between items-center text-xs text-slate-400">
            <span className="font-mono text-cyan-400">Frame: 1024 × 768 Normalized Geometry</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShelfPhoto(!showShelfPhoto)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold border flex items-center gap-1 transition-all ${
                  showShelfPhoto ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-white/5 text-slate-400 border-white/10'
                }`}
              >
                <ImageIcon className="w-3 h-3" />
                <span>Shelf Photo {showShelfPhoto ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {/* 4 Quadrants Dynamic CAD Geometry */}
          <div className="relative z-10 flex flex-col gap-2.5 my-4 min-h-[360px] w-full">
            {/* Top Deck Row (Height modulated by ySplit) */}
            <div
              style={{ flex: `${ySplit * 100} 1 0%`, minHeight: '140px' }}
              className="flex gap-2.5 w-full transition-all duration-150"
            >
              {/* Top-Left: Lay's */}
              <div
                style={{ flex: `${topXSplit * 100} 1 0%` }}
                className="p-4 rounded-xl border-2 border-dashed border-amber-500/60 bg-amber-500/10 backdrop-blur-sm flex flex-col justify-between transition-all duration-150"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-amber-300 uppercase block">Top-Left Deck</span>
                    <span className="text-[10px] text-amber-200/80">Snacks &amp; Chips Zone</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/30 text-amber-100 border border-amber-500/40">
                    {zones.TOP_LEFT.sku}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-zinc-300 bg-black/60 px-2 py-0.5 rounded inline-block w-fit">
                  X: [0.00..{topXSplit.toFixed(2)}] | Y: [0.00..{ySplit.toFixed(2)}]
                </div>
              </div>

              {/* Top-Right: Coca-Cola */}
              <div
                style={{ flex: `${(1 - topXSplit) * 100} 1 0%` }}
                className="p-4 rounded-xl border-2 border-dashed border-rose-500/60 bg-rose-500/10 backdrop-blur-sm flex flex-col justify-between transition-all duration-150"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-rose-300 uppercase block">Top-Right Deck</span>
                    <span className="text-[10px] text-rose-200/80">Beverages Zone</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/30 text-rose-100 border border-rose-500/40">
                    {zones.TOP_RIGHT.sku}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-zinc-300 bg-black/60 px-2 py-0.5 rounded inline-block w-fit">
                  X: [{topXSplit.toFixed(2)}..1.00] | Y: [0.00..{ySplit.toFixed(2)}]
                </div>
              </div>
            </div>

            {/* Bottom Shelf Row (Height modulated by 1 - ySplit) */}
            <div
              style={{ flex: `${(1 - ySplit) * 100} 1 0%`, minHeight: '140px' }}
              className="flex gap-2.5 w-full transition-all duration-150"
            >
              {/* Bottom-Left: KitKat (Clean slate/monochrome, NO PURPLE) */}
              <div
                style={{ flex: `${bottomXSplit * 100} 1 0%` }}
                className="p-4 rounded-xl border-2 border-dashed border-zinc-400/60 bg-zinc-800/40 backdrop-blur-sm flex flex-col justify-between transition-all duration-150"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-zinc-200 uppercase block">Bottom-Left Shelf</span>
                    <span className="text-[10px] text-zinc-400">Confectionery Interior</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white border border-white/20">
                    {zones.BOTTOM_LEFT.sku}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-zinc-300 bg-black/60 px-2 py-0.5 rounded inline-block w-fit">
                  X: [0.00..{bottomXSplit.toFixed(2)}] | Y: [{ySplit.toFixed(2)}..1.00]
                </div>
              </div>

              {/* Bottom-Right: Oreo */}
              <div
                style={{ flex: `${(1 - bottomXSplit) * 100} 1 0%` }}
                className="p-4 rounded-xl border-2 border-dashed border-sky-500/60 bg-sky-500/10 backdrop-blur-sm flex flex-col justify-between transition-all duration-150"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-sky-300 uppercase block">Bottom-Right Shelf</span>
                    <span className="text-[10px] text-sky-200/80">Biscuits &amp; Cookies</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/30 text-sky-100 border border-sky-500/40">
                    {zones.BOTTOM_RIGHT.sku}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-zinc-300 bg-black/60 px-2 py-0.5 rounded inline-block w-fit">
                  X: [{bottomXSplit.toFixed(2)}..1.00] | Y: [{ySplit.toFixed(2)}..1.00]
                </div>
              </div>
            </div>
          </div>

          {/* Misplacement Simulation Toast (if active) */}
          {simulatedMisplacement && (
            <div className="relative z-10 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-200 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  <strong>Simulation:</strong> {simulatedMisplacement.message}
                </span>
              </div>
              <button
                onClick={() => setSimulatedMisplacement(null)}
                className="text-[10px] px-2 py-0.5 rounded bg-rose-500/30 hover:bg-rose-500/50 text-white font-bold"
              >
                Clear
              </button>
            </div>
          )}

          {/* Footer Telemetry */}
          <div className="relative z-10 text-[11px] text-slate-400 flex justify-between pt-2 border-t border-white/10">
            <span>Y-Partition Midpoint: {(ySplit * 100).toFixed(0)}% Height</span>
            <span>Cluster Decomposition Aspect Ratio: &gt; 0.85</span>
          </div>
        </div>

        {/* Boundary Partition Sliders & Controls */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Boundary Partition Sliders</span>
            </h4>

            {/* Horizontal Y Split */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Shelf Deck Split (Height):</span>
                <span className="font-mono text-indigo-400 font-bold">{Math.round(ySplit * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.35"
                max="0.65"
                step="0.01"
                value={ySplit}
                onChange={(e) => setYSplit(parseFloat(e.target.value))}
                className="w-full accent-indigo-400 cursor-pointer"
              />
            </div>

            {/* Top Deck X Split */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Top Deck Split (Lay's vs Coke):</span>
                <span className="font-mono text-cyan-400 font-bold">{Math.round(topXSplit * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.65"
                step="0.01"
                value={topXSplit}
                onChange={(e) => setTopXSplit(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Bottom Shelf X Split */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Bottom Shelf Split (KitKat vs Oreo):</span>
                <span className="font-mono text-zinc-300 font-bold">{Math.round(bottomXSplit * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.65"
                step="0.01"
                value={bottomXSplit}
                onChange={(e) => setBottomXSplit(parseFloat(e.target.value))}
                className="w-full accent-white cursor-pointer"
              />
            </div>

            {/* SKU Quadrant Selectors */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="text-[11px] text-slate-400 font-bold uppercase">Designated SKU Allocations</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Top-Left</span>
                  <select
                    value={zones.TOP_LEFT.sku}
                    onChange={(e) => setZones({ ...zones, TOP_LEFT: { ...zones.TOP_LEFT, sku: e.target.value } })}
                    className="w-full p-1.5 rounded bg-black/60 border border-white/10 text-white text-xs"
                  >
                    <option value="Lays">Lay's</option>
                    <option value="CocaCola">Coca-Cola</option>
                    <option value="KitKat">KitKat</option>
                    <option value="Oreo">Oreo</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block">Top-Right</span>
                  <select
                    value={zones.TOP_RIGHT.sku}
                    onChange={(e) => setZones({ ...zones, TOP_RIGHT: { ...zones.TOP_RIGHT, sku: e.target.value } })}
                    className="w-full p-1.5 rounded bg-black/60 border border-white/10 text-white text-xs"
                  >
                    <option value="CocaCola">Coca-Cola</option>
                    <option value="Lays">Lay's</option>
                    <option value="KitKat">KitKat</option>
                    <option value="Oreo">Oreo</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block">Bottom-Left</span>
                  <select
                    value={zones.BOTTOM_LEFT.sku}
                    onChange={(e) => setZones({ ...zones, BOTTOM_LEFT: { ...zones.BOTTOM_LEFT, sku: e.target.value } })}
                    className="w-full p-1.5 rounded bg-black/60 border border-white/10 text-white text-xs"
                  >
                    <option value="KitKat">KitKat</option>
                    <option value="Oreo">Oreo</option>
                    <option value="Lays">Lay's</option>
                    <option value="CocaCola">Coca-Cola</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block">Bottom-Right</span>
                  <select
                    value={zones.BOTTOM_RIGHT.sku}
                    onChange={(e) => setZones({ ...zones, BOTTOM_RIGHT: { ...zones.BOTTOM_RIGHT, sku: e.target.value } })}
                    className="w-full p-1.5 rounded bg-black/60 border border-white/10 text-white text-xs"
                  >
                    <option value="Oreo">Oreo</option>
                    <option value="KitKat">KitKat</option>
                    <option value="CocaCola">Coca-Cola</option>
                    <option value="Lays">Lay's</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Misplacement Interactive Test Bench */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="text-[11px] text-slate-400 font-bold uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Misplacement Test Simulator</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Simulate moving an item to another quadrant to verify immediate triangulation articulation:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerMisplacementTest('KitKat', 'TOP_LEFT')}
                  className="px-2.5 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold text-left transition-all"
                >
                  Move KitKat → Near Lay's
                </button>
                <button
                  onClick={() => triggerMisplacementTest('KitKat', 'TOP_RIGHT')}
                  className="px-2.5 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold text-left transition-all"
                >
                  Move KitKat → Near Coke
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
