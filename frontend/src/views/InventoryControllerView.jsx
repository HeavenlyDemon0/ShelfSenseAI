import React, { useState, useEffect } from 'react'
import {
  Boxes,
  Layers,
  PackageCheck,
  AlertCircle,
  Download,
  Database,
  ArrowRight,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  BellRing,
} from 'lucide-react'
import { syncInventoryCounts, isSupabaseConfigured } from '../lib/supabaseClient'
import confetti from 'canvas-confetti'
import ReplenishmentQueue from '../components/ReplenishmentQueue'

export default function InventoryControllerView({ state, onRefresh }) {
  const products = state?.products || { CocaCola: 1, KitKat: 3, Lays: 1, Oreo: 1 }
  const [thresholds, setThresholds] = useState(
    state?.reorder_thresholds || { CocaCola: 2, KitKat: 3, Lays: 2, Oreo: 2 }
  )
  const [syncing, setSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)
  const [updatingThreshold, setUpdatingThreshold] = useState(false)

  // Sync state thresholds when props change
  useEffect(() => {
    if (state?.reorder_thresholds) {
      setThresholds(state.reorder_thresholds)
    }
  }, [state?.reorder_thresholds])

  const handleAdjustThreshold = async (sku, delta) => {
    const cur = thresholds[sku] ?? 2
    const nextVal = Math.max(1, cur + delta)
    const newThresholds = { ...thresholds, [sku]: nextVal }
    setThresholds(newThresholds)

    setUpdatingThreshold(true)
    try {
      const res = await fetch('/api/inventory/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholds: newThresholds }),
      })
      if (res.ok) {
        if (onRefresh) onRefresh()
      }
    } catch (err) {
      console.error('Threshold update error:', err)
    } finally {
      setUpdatingThreshold(false)
    }
  }

  const handleSyncSupabase = async () => {
    setSyncing(true)
    const res = await syncInventoryCounts(products)
    setSyncing(false)
    setSyncSuccess(true)
    confetti({ particleCount: 35, spread: 60 })
    setTimeout(() => setSyncSuccess(false), 3000)
  }

  // Filter alerts for low stock / stockouts
  const stockAlerts = (state?.alerts || []).filter(
    (a) => a.type === 'LOW_STOCK' || a.type === 'STOCKOUT'
  )

  const skuList = [
    {
      sku: 'CocaCola',
      name: 'Coca-Cola Classic',
      deck: 'Top-Right (Beverages)',
      color: 'rose',
      border: 'border-rose-500/30',
      badgeBg: 'bg-rose-500/10 text-rose-400',
    },
    {
      sku: 'KitKat',
      name: 'KitKat Mini Stack',
      deck: 'Bottom-Left (Confectionery)',
      color: 'zinc',
      border: 'border-zinc-700/50',
      badgeBg: 'bg-zinc-800 text-zinc-300',
    },
    {
      sku: 'Lays',
      name: "Lay's Classic Chips",
      deck: 'Top-Left (Snacks)',
      color: 'amber',
      border: 'border-amber-500/30',
      badgeBg: 'bg-amber-500/10 text-amber-400',
    },
    {
      sku: 'Oreo',
      name: 'Oreo Vanilla Biscuits',
      deck: 'Bottom-Right (Biscuits)',
      color: 'sky',
      border: 'border-sky-500/30',
      badgeBg: 'bg-sky-500/10 text-sky-400',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Boxes className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Inventory Controller Desk</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Adjustable Store Reorder Thresholds
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            Store-configured minimum replenishment numbers with automated low-stock alert triggers and cloud database synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncSupabase}
            disabled={syncing}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Database className="w-4 h-4" />
            <span>{syncing ? 'Syncing...' : syncSuccess ? 'Synced to Supabase' : 'Sync to Supabase'}</span>
          </button>
        </div>
      </div>

      {/* Active Low Stock Alerts Banner (if any) */}
      {stockAlerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md space-y-2">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <BellRing className="w-4 h-4 animate-bounce" />
            <span>Active Store Replenishment Alerts ({stockAlerts.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stockAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 rounded-xl bg-black/40 border border-amber-500/20 text-xs flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>{alert.title}</span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{alert.message}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    alert.severity === 'CRITICAL'
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40'
                      : 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                  }`}
                >
                  {alert.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Interactive Product Inventory & Threshold Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {skuList.map((item) => {
          const count = products[item.sku] ?? 0
          const minRequired = thresholds[item.sku] ?? 2
          const isStockout = count === 0
          const isLowStock = count < minRequired

          return (
            <div
              key={item.sku}
              className={`p-5 rounded-2xl bg-white/[0.03] border ${
                isStockout
                  ? 'border-rose-500/50 bg-rose-500/5 shadow-rose-500/10'
                  : isLowStock
                  ? 'border-amber-500/50 bg-amber-500/5 shadow-amber-500/10'
                  : item.border
              } relative overflow-hidden transition-all shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{item.name}</span>
                <span className={`w-8 h-8 rounded-lg ${item.badgeBg} flex items-center justify-center text-sm`}>
                  {item.icon}
                </span>
              </div>

              {/* Live Count Display */}
              <div className="flex items-baseline gap-2 mt-3">
                <div className="text-3xl font-black text-white font-mono">{count}</div>
                <span className="text-xs text-slate-400">units on shelf</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{item.deck}</div>

              {/* Status Badge */}
              <div className="mt-3">
                {isStockout ? (
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 w-fit">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>OUT OF STOCK</span>
                  </span>
                ) : isLowStock ? (
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 w-fit">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    <span>LOW STOCK (Need +{minRequired - count})</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 w-fit">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>HEALTHY STOCK</span>
                  </span>
                )}
              </div>

              {/* Store Adjustable Reorder Threshold Stepper */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1.5">
                  <span>Store Min Threshold:</span>
                  <span className="font-mono text-cyan-300 font-bold">{minRequired} units</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAdjustThreshold(item.sku, -1)}
                    disabled={minRequired <= 1}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center justify-center font-bold text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Decrease Threshold"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <div className="flex-1 py-1 px-2 rounded-lg bg-black/40 border border-white/10 text-center font-mono text-sm font-bold text-white">
                    {minRequired}
                  </div>

                  <button
                    onClick={() => handleAdjustThreshold(item.sku, 1)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center justify-center font-bold text-xs transition-all"
                    title="Increase Threshold"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 text-center">Adjustable by store manager</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Deep Learning Replenishment Queue & Velocity Forecast Module */}
      <ReplenishmentQueue onRestocked={onRefresh} />
    </div>
  )
}
