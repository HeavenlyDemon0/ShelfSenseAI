import React, { useState, useEffect } from 'react'
import {
  Cpu,
  Camera,
  Play,
  Square,
  Layers,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Box,
  Eye,
  Rotate3d,
  Database,
  BarChart3,
  BellRing,
  Check,
  Zap,
  PlusCircle,
  LayoutGrid,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import DigitalTwin3D from '../components/DigitalTwin3D'
import PlanogramCadView from './PlanogramCadView'
import InventoryControllerView from './InventoryControllerView'
import RetailAnalystView from './RetailAnalystView'
import ReplenishmentQueue from '../components/ReplenishmentQueue'
import FewShotStudio from '../components/FewShotStudio'
import { soundEffects } from '../lib/audioAlerts'

export default function AdminDevView({ state, planogram, onRefresh, loading }) {
  const [activeLayout, setActiveLayout] = useState('all') // 'all', 'camera', 'replenishment', 'cad', 'fewshot', 'twin3d'
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraIndex, setCameraIndex] = useState(0)
  const [resolvedAlerts, setResolvedAlerts] = useState([])
  const [liveTelemetry, setLiveTelemetry] = useState(null)

  // Poll state when camera is active so YOLO Detections list updates in real-time
  useEffect(() => {
    if (!isCameraActive) {
      setLiveTelemetry(null)
      return
    }
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/state')
        if (res.ok) {
          const data = await res.json()
          if (data) setLiveTelemetry(data)
        }
      } catch (e) {}
    }, 1200)

    return () => clearInterval(interval)
  }, [isCameraActive])

  const detections = liveTelemetry?.detections || state?.detections || []
  const products = liveTelemetry?.products || state?.products || { CocaCola: 1, KitKat: 3, Lays: 1, Oreo: 1 }
  const compliancePct = liveTelemetry?.compliance_pct ?? state?.compliance_pct ?? 100
  const misplacedCount = liveTelemetry?.misplaced_count ?? state?.misplaced_count ?? 0
  const alerts = (liveTelemetry?.alerts || state?.alerts || []).filter((a) => !resolvedAlerts.includes(a.id))
  const misplacements = liveTelemetry?.planogram?.misplacements || state?.planogram?.misplacements || []

  // Check camera status on mount
  useEffect(() => {
    fetch('/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.camera_active) setIsCameraActive(true)
      })
      .catch(() => {})
  }, [])

  const toggleCamera = async (start) => {
    try {
      if (start) {
        await fetch(`/api/camera/start?camera_index=${cameraIndex}`, { method: 'POST' })
        setIsCameraActive(true)
      } else {
        await fetch('/api/camera/stop', { method: 'POST' })
        setIsCameraActive(false)
      }
    } catch (err) {
      console.warn('Camera toggle error:', err)
      setIsCameraActive(start)
    }
  }

  const handleResolveAlert = async (alertId) => {
    setResolvedAlerts((prev) => [...prev, alertId])
    try {
      await fetch('/api/alerts/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      })
    } catch (err) {
      console.warn('Alert dismiss error:', err)
    }
    confetti({ particleCount: 25, spread: 50 })
  }

  const handleRunImmediateScan = () => {
    if (onRefresh) onRefresh()
    confetti({ particleCount: 30, spread: 45 })
  }

  // Camera HUD Component (used in both All-Widgets view and filtered view)
  const renderCameraWidget = () => (
    <div className="figma-card p-6 space-y-4">
      <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-zinc-300" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Live Hardware Camera HUD &amp; Neural Stream
          </h3>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            isCameraActive
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-white/10 text-zinc-400'
          }`}
        >
          {isCameraActive ? 'LIVE HARDWARE MJPEG' : 'STANDBY SNAPSHOT'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Video Viewport */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black flex items-center justify-center shadow-2xl">
            {isCameraActive ? (
              <img
                src="/api/video_feed"
                alt="Live ShelfSense Stream"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="relative w-full h-full overflow-hidden">
                <img
                  src="/assets/images/physical_shelf_annotated.jpg"
                  alt="Physical Shelf Reference"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.onerror = null
                    e.target.src = '/results/final_shelf_pred/media_1792497884461_b1ac6007.jpg'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Physical Shelf Test Fixture Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Click &quot;Start Live Camera&quot; below to stream USB webcam directly in this window.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Camera Hardware Control Bar (WITH CLEAR START AND STOP BUTTONS) */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2.5 text-xs text-zinc-400">
              <span>Device Index:</span>
              <select
                value={cameraIndex}
                onChange={(e) => setCameraIndex(Number(e.target.value))}
                disabled={isCameraActive}
                className="p-1.5 rounded-lg bg-[#15171c] border border-white/10 text-white text-xs font-mono"
              >
                <option value={0}>Camera 0 (Default DirectShow)</option>
                <option value={1}>Camera 1 (External USB)</option>
                <option value={2}>Camera 2 (Secondary)</option>
              </select>
            </div>

            {/* PERMANENT SIDE-BY-SIDE START AND STOP BUTTONS */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCamera(true)}
                disabled={isCameraActive}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isCameraActive
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Live Camera</span>
              </button>

              <button
                type="button"
                onClick={() => toggleCamera(false)}
                disabled={!isCameraActive}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  !isCameraActive
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                }`}
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Camera</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Detected Items List */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                YOLO Detections ({detections.length})
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">Real-Time</span>
            </div>

            <div className="space-y-1.5 max-h-[290px] overflow-y-auto pr-1">
              {detections.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  No active detections on shelf.
                </div>
              ) : (
                detections.map((det, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">
                        #{det.track_id || idx + 1} {det.class_name || det.class}
                      </span>
                      <span className="text-[10px] text-zinc-400 block font-mono">
                        Bbox: [{det.bbox?.map((v) => Math.round(v)).join(', ')}]
                      </span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">
                      {Math.round((det.confidence || 0.9) * 100)}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 text-[10px] text-zinc-500 font-mono">
            4 Classes: CocaCola, KitKat, Lays, Oreo
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="figma-card p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-5 h-5 text-zinc-200" />
            <h1 className="text-2xl font-black text-white tracking-tight">
              Retail Vision Master Command Hub
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-white border border-white/20">
              Operations Center
            </span>
          </div>
          <p className="text-zinc-400 text-xs">
            Integrated widgets: Live hardware video stream, planogram CAD triangulation, replenishment queue, and few-shot online learning.
          </p>
        </div>

        <button
          onClick={handleRunImmediateScan}
          disabled={loading}
          className="btn-tactile-white text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Evaluating...' : 'Run Shelf Scan'}</span>
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="figma-card p-5">
          <span className="text-xs text-zinc-400 block">Planogram Compliance</span>
          <div className="text-3xl font-black text-white font-mono mt-1">{compliancePct}%</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Spatial layout compliant</span>
          </div>
        </div>

        <div className="figma-card p-5">
          <span className="text-xs text-zinc-400 block">Misplaced Items</span>
          <div className="text-3xl font-black text-white font-mono mt-1">{misplacedCount}</div>
          <div className={`text-[11px] mt-1 ${misplacedCount > 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
            {misplacedCount > 0 ? 'Actionable departures flagged' : 'Zero departures'}
          </div>
        </div>

        <div className="figma-card p-5">
          <span className="text-xs text-zinc-400 block">Total Units Counted</span>
          <div className="text-3xl font-black text-white font-mono mt-1">
            {Object.values(products).reduce((a, b) => a + b, 0)} Units
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">Decomposed KitKat cluster</div>
        </div>

        <div className="figma-card p-5">
          <span className="text-xs text-zinc-400 block">Active Alerts</span>
          <div className="text-3xl font-black text-amber-300 font-mono mt-1">{alerts.length}</div>
          <div className="text-[11px] text-zinc-400 mt-1">Stockouts &amp; misplacements</div>
        </div>
      </div>

      {/* Widget Layout Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/[0.08]">
        {[
          { id: 'all', label: 'All Operations Widgets', icon: LayoutGrid },
          { id: 'camera', label: 'Live Camera HUD', icon: Camera },
          { id: 'replenishment', label: 'Replenishment Queue', icon: Zap },
          { id: 'cad', label: 'Planogram CAD Tuner', icon: SlidersHorizontal },
          { id: 'fewshot', label: 'Few-Shot Studio', icon: PlusCircle },
          { id: 'twin3d', label: '3D Digital Twin', icon: Rotate3d },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeLayout === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveLayout(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: ALL WIDGETS FLOW LAYOUT                             */}
      {/* ============================================================== */}
      {activeLayout === 'all' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Widget 1: Live Hardware Camera HUD */}
          {renderCameraWidget()}

          {/* Widget 2: Misplacements & Immediate Neighbor Remediation */}
          <div className="figma-card p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-zinc-300" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Real-Time Planogram Departure &amp; Neighbor Context Remediation
                </h3>
              </div>
              <span className="text-xs text-zinc-400 font-mono">
                {alerts.length === 0 ? 'All Clear' : `${alerts.length} unresolved alerts`}
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                All shelf items are currently aligned with the designated planogram. Zero departures.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-xl bg-black/40 border border-white/10 flex justify-between items-start gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{alert.title || alert.product}</span>
                        <span
                          className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                            alert.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {alert.type}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1">{alert.message}</p>
                      {alert.neighbor_sku && (
                        <div className="text-[11px] text-zinc-400 mt-1 font-mono">
                          Neighboring SKU: {alert.neighbor_sku} | Return to: {alert.expected_zone}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleResolveAlert(alert.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shrink-0"
                    >
                      Resolve
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Widget 3: PyTorch ML Replenishment Priority Queue */}
          <div className="space-y-3">
            <ReplenishmentQueue onRestocked={onRefresh} />
          </div>

          {/* Widget 4: Planogram CAD Boundary Tuner */}
          <div className="space-y-3">
            <PlanogramCadView onApplied={onRefresh} />
          </div>

          {/* Widget 5: Few-Shot SKU Enrollment & Continual Learning */}
          <div className="space-y-3">
            <FewShotStudio onScanRefresh={onRefresh} />
          </div>

          {/* Widget 6: Interactive 3D Digital Twin */}
          <div className="figma-card p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Rotate3d className="w-4 h-4 text-zinc-300" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Three.js Spatial Digital Twin
                </h3>
              </div>
              <span className="text-xs text-zinc-400 font-mono">WebGL Orbit Controls</span>
            </div>
            <DigitalTwin3D state={state} planogram={planogram} onRefresh={onRefresh} />
          </div>
        </div>
      )}

      {/* FILTERED SINGLE WIDGET VIEWS */}
      {activeLayout === 'camera' && renderCameraWidget()}
      {activeLayout === 'replenishment' && <ReplenishmentQueue onRestocked={onRefresh} />}
      {activeLayout === 'cad' && <PlanogramCadView onApplied={onRefresh} />}
      {activeLayout === 'fewshot' && <FewShotStudio onScanRefresh={onRefresh} />}
      {activeLayout === 'twin3d' && (
        <div className="figma-card p-6">
          <DigitalTwin3D state={state} planogram={planogram} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  )
}
