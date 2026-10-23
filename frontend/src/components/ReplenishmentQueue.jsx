import React, { useState, useEffect } from 'react'
import {
  Clock,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Package,
  CheckCircle2,
  Download,
  Sparkles,
  Flame,
  Zap,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { soundEffects } from '../lib/audioAlerts'

export default function ReplenishmentQueue({ onRestocked }) {
  const [queueData, setQueueData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dispatchingSku, setDispatchingSku] = useState(null)
  const [forecastData, setForecastData] = useState(null)
  const [showForecast, setShowForecast] = useState(false)

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/replenishment/queue')
      if (res.ok) {
        const data = await res.json()
        setQueueData(data)
      }
    } catch (err) {
      console.warn('Replenishment queue fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchForecast = async () => {
    try {
      const res = await fetch('/api/replenishment/forecast')
      if (res.ok) {
        const data = await res.json()
        setForecastData(data)
      }
    } catch (err) {}
  }

  useEffect(() => {
    fetchQueue()
    fetchForecast()
    const interval = setInterval(fetchQueue, 6000)
    return () => clearInterval(interval)
  }, [])

  const handleDispatch = async (sku, unitsNeeded) => {
    setDispatchingSku(sku)
    soundEffects.playDispatch()
    try {
      const res = await fetch('/api/replenishment/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, quantity: unitsNeeded }),
      })
      if (res.ok) {
        const data = await res.json()
        setQueueData(data.replenishment_queue)
        confetti({ particleCount: 35, spread: 55 })
        if (onRestocked) onRestocked(data)
      }
    } catch (err) {
      console.error('Dispatch error:', err)
    } finally {
      setDispatchingSku(null)
    }
  }

  const handleExportAudit = async () => {
    try {
      const res = await fetch('/api/audit/report')
      if (res.ok) {
        const report = await res.json()
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ShelfSense_Store_Audit_Report_${Date.now()}.json`
        a.click()
        soundEffects.playSuccess()
        confetti({ particleCount: 25 })
      }
    } catch (err) {}
  }

  const queue = queueData?.queue || []
  const summary = queueData?.summary || {}

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-2xl font-black text-white tracking-tight">
              AI Replenishment Prioritization &amp; Velocity Queue
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Deep Neural RankNet v1.0
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            Multi-task ML model forecasting consumption velocity, runout minutes, and optimal restocking sequence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForecast(!showForecast)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              showForecast
                ? 'bg-indigo-500/30 text-indigo-300 border-indigo-500/50'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{showForecast ? 'Hide 24h Velocity' : '24h Velocity Forecast'}</span>
          </button>

          <button
            onClick={handleExportAudit}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Store Audit</span>
          </button>
        </div>
      </div>

      {/* Rush Hour & Capacity Live Pill Banner */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-wrap justify-between items-center gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white">Active Predictive Model:</span>
            <span className="text-cyan-400 font-mono">ShelfSenseReplenishmentNet (PyTorch CUDA)</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <Flame className={`w-3.5 h-3.5 ${queueData?.is_rush_hour ? 'text-amber-400 animate-bounce' : 'text-slate-500'}`} />
            <span className={queueData?.is_rush_hour ? 'text-amber-300 font-bold' : 'text-slate-400'}>
              {queueData?.is_rush_hour ? 'PEAK RUSH HOUR SURGE (2.4x Velocity)' : 'Standard Shopping Velocity'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>Critical Stockouts: <strong className="text-rose-400">{summary.critical_refill_count ?? 0}</strong></span>
          <span>High Urgency SKUs: <strong className="text-amber-400">{summary.high_priority_count ?? 0}</strong></span>
          <span>Units Needed: <strong className="text-cyan-300">{summary.total_refill_units_needed ?? 0}</strong></span>
        </div>
      </div>

      {/* 24-Hour Forecast Curve (if toggled) */}
      {showForecast && forecastData && (
        <div className="p-6 rounded-2xl bg-black border border-white/10 space-y-3 animate-in fade-in duration-200">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Projected 24-Hour Velocity Curve (Units / Hour Demand)</span>
            </span>
            <span className="text-slate-500 font-mono">Diurnal Non-Stationary Poisson Model</span>
          </div>

          <div className="grid grid-cols-12 gap-1.5 pt-3">
            {forecastData.hourly_projections?.slice(6, 24).map((proj) => (
              <div
                key={proj.hour}
                className={`p-2 rounded-lg text-center flex flex-col justify-end min-h-[90px] border transition-all ${
                  proj.is_current
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold shadow-lg shadow-cyan-500/20'
                    : proj.is_rush
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-white/[0.02] border-white/5 text-slate-400'
                }`}
              >
                <div className="text-[10px] font-mono mb-1">{proj.total_velocity.toFixed(1)} u/h</div>
                <div
                  className={`w-full rounded-sm ${
                    proj.is_current ? 'bg-cyan-400' : proj.is_rush ? 'bg-amber-400' : 'bg-slate-700'
                  }`}
                  style={{ height: `${Math.min(100, proj.total_velocity * 8)}%` }}
                />
                <span className="text-[9px] mt-1 font-mono block">{proj.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prioritized Restocking Queue Cards (Sorted Order 1 to 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {queue.map((item) => {
          const isTop = item.refill_rank === 1
          const isDispatching = dispatchingSku === item.sku
          const isCritical = item.priority_tier === 'CRITICAL'
          const isHigh = item.priority_tier === 'HIGH'

          return (
            <div
              key={item.sku}
              className={`p-5 rounded-2xl bg-white/[0.03] border relative overflow-hidden transition-all shadow-xl ${
                isTop
                  ? 'border-amber-500/50 shadow-amber-500/10 bg-amber-500/[0.04]'
                  : isCritical
                  ? 'border-rose-500/40 bg-rose-500/[0.03]'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              {/* Card Header with Rank */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs font-mono border ${
                      isTop
                        ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30'
                        : 'bg-white/10 text-white border-white/10'
                    }`}
                  >
                    #{item.refill_rank}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white">{item.sku}</h3>
                    <span className="text-[11px] text-slate-400">{item.deck} • {item.category}</span>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    item.priority_tier === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : item.priority_tier === 'HIGH'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : item.priority_tier === 'MEDIUM'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {item.priority_tier} PRIORITY
                </span>
              </div>

              {/* Urgency Progress Bar */}
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Replenishment Urgency Score</span>
                  <span className="font-mono text-cyan-300 font-bold">{item.urgency_score} / 100</span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-white/5">
                  <div
                    className={`h-full transition-all duration-500 ${
                      item.urgency_score >= 70
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                        : item.urgency_score >= 40
                        ? 'bg-gradient-to-r from-cyan-500 to-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, item.urgency_score)}%` }}
                  />
                </div>
              </div>

              {/* 3 Metric Grid */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/5 text-center text-xs">
                <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Current Stock</span>
                  <span className="font-bold font-mono text-white text-sm">
                    {item.current_stock} / {item.max_capacity}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Est. Runout</span>
                  <span
                    className={`font-bold font-mono text-sm ${
                      item.runout_minutes < 60 ? 'text-rose-400' : 'text-slate-200'
                    }`}
                  >
                    {item.current_stock === 0 ? '0 min (OOS)' : `${item.runout_minutes} min`}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Velocity</span>
                  <span className="font-bold font-mono text-cyan-300 text-sm">
                    {item.predicted_velocity_units_hr} u/h
                  </span>
                </div>
              </div>

              {/* Action Button: Dispatch Staff Refill */}
              <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                <div className="text-[11px] text-slate-400">
                  Deficit: <strong className="text-white">{item.depletion_deficit}</strong> • Restock: <strong className="text-cyan-300">+{item.recommended_refill_units} units</strong>
                </div>

                <button
                  onClick={() => handleDispatch(item.sku, item.recommended_refill_units || 4)}
                  disabled={isDispatching || item.current_stock >= item.max_capacity}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                    item.current_stock >= item.max_capacity
                      ? 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                      : isTop
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-amber-500/20'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>
                    {isDispatching ? 'Restocking...' : item.current_stock >= item.max_capacity ? 'Full Capacity' : `Restock Now (+${item.recommended_refill_units || 4})`}
                  </span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

