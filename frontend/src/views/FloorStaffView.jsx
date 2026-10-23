import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  ArrowRight, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Clock, 
  Layers,
  ShoppingCart
} from 'lucide-react'
import confetti from 'canvas-confetti'

export default function FloorStaffView({ 
  state, 
  planogram, 
  onRefresh, 
  loading 
}) {
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [resolvedIds, setResolvedIds] = useState(new Set())

  // Live alerts from state (misplacements + store-adjustable low-stock)
  const engineAlerts = state?.alerts || []
  const misplacements = planogram?.misplacements || []

  // Combine engine alerts with misplacements
  const activeAlerts = engineAlerts.length > 0
    ? engineAlerts.map(a => ({
        track_id: a.id,
        class_name: a.product,
        actual_zone_name: a.zone,
        expected_zone_name: a.expected_zone || a.zone,
        neighbor_sku: a.neighbor_sku,
        message: a.message,
        type: a.type,
        severity: a.severity,
        timestamp: 'Just now'
      }))
    : (misplacements.length > 0 ? misplacements : [
        {
          track_id: 104,
          class_name: 'KitKat',
          actual_zone_name: 'Top-Left Deck',
          expected_zone_name: 'Bottom-Left Shelf',
          neighbor_sku: 'Lays',
          message: "KitKat is misplaced! Placed in Top-Left Deck (near Lay's) instead of Bottom-Left Shelf.",
          timestamp: '2 mins ago',
          type: 'MISPLACEMENT',
          severity: 'WARNING'
        }
      ])

  const handleResolve = (id, e) => {
    e.stopPropagation()
    const next = new Set(resolvedIds)
    next.add(id)
    setResolvedIds(next)

    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.6 }
    })
  }

  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Floor Staff Action Center</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Restock &amp; Remediation
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            Real-time feed of products displaced by shoppers. Follow the highlighted neighbor product to fix placements instantly.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              audioEnabled 
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' 
                : 'bg-white/[0.02] border-white/10 text-slate-500'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{audioEnabled ? 'Chimes Active' : 'Muted'}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-semibold flex items-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Scan Shelf Now</span>
          </button>
        </div>
      </div>

      {/* 4 Quadrants Quick Glance Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Top-Left Deck</div>
          <div className="text-base font-extrabold text-white mt-1">Lay's Snacks</div>
          <div className="text-xs text-slate-400 mt-1">Status: <span className="text-emerald-400 font-semibold">Ready</span></div>
        </div>

        <div className="p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/20">
          <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Top-Right Deck</div>
          <div className="text-base font-extrabold text-white mt-1">Coca-Cola</div>
          <div className="text-xs text-slate-400 mt-1">Status: <span className="text-emerald-400 font-semibold">Ready</span></div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <div className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Bottom-Left Shelf</div>
          <div className="text-base font-extrabold text-white mt-1">KitKat Stack</div>
          <div className="text-xs text-slate-400 mt-1">Status: <span className="text-emerald-400 font-semibold">3 Bars Active</span></div>
        </div>

        <div className="p-4 rounded-xl bg-sky-500/[0.06] border border-sky-500/20">
          <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Bottom-Right Shelf</div>
          <div className="text-base font-extrabold text-white mt-1">Oreo Biscuits</div>
          <div className="text-xs text-slate-400 mt-1">Status: <span className="text-emerald-400 font-semibold">Ready</span></div>
        </div>
      </div>

      {/* Priority Misplacement Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Priority Floor Action Items</span>
          </h2>
          <span className="text-xs text-slate-500">
            {activeAlerts.filter(a => !resolvedIds.has(a.track_id)).length} pending remediation
          </span>
        </div>

        <AnimatePresence>
          {activeAlerts.map((alert) => {
            const isResolved = resolvedIds.has(alert.track_id)
            if (isResolved) return null

            return (
              <motion.div
                key={alert.track_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-5 rounded-2xl bg-gradient-to-r from-rose-500/[0.12] via-rose-500/[0.05] to-transparent border border-rose-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl shadow-rose-950/20"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-white">
                        {alert.class_name || alert.product} Misplaced
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/30 text-rose-200">
                        HIGH PRIORITY
                      </span>
                    </div>

                    <p className="text-xs text-rose-200/90 mt-1 font-medium">
                      {alert.message}
                    </p>

                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 text-amber-300">
                        <MapPin className="w-3.5 h-3.5" />
                        Found in: <strong>{alert.actual_zone_name || alert.current_zone}</strong>
                      </span>
                      <span>→</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        Target: <strong>{alert.expected_zone_name || alert.expected_zone}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto flex items-center justify-end">
                  <button
                    onClick={(e) => handleResolve(alert.track_id, e)}
                    className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Put Back in Target Zone</span>
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {activeAlerts.every(a => resolvedIds.has(a.track_id)) && (
          <div className="p-8 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/30 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-white">All Floor Items Correctly Placed!</h3>
            <p className="text-xs text-slate-400 mt-1">
              Zero active misplacements detected by edge YOLO11n. The shelf is 100% compliant.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}

