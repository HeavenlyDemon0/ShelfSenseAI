import React from 'react'
import { 
  Store, 
  CheckCircle, 
  AlertOctagon, 
  Clock, 
  Users, 
  TrendingUp, 
  Layers,
  ArrowUpRight
} from 'lucide-react'

export default function StoreManagerView({ state, planogram, onRefresh }) {
  const compliance = state?.compliance_pct ?? 100
  const products = state?.products || { CocaCola: 1, KitKat: 3, Lays: 1, Oreo: 1 }
  const totalUnits = Object.values(products).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Store Manager Operations Deck</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Shift Operational Health
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            Store-wide compliance velocity, incident remediation cycle times, and quadrant distribution summary.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
        >
          Refresh Store Telemetry
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Overall Planogram Compliance</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-2">{compliance}%</div>
          <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+3.2% vs store target (95.0%)</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Remediation MTTR</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-black text-white mt-2">3.8 min</div>
          <div className="text-[11px] text-cyan-400 mt-1">
            <span>Average time to put back items</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Active Shelf Capacity</span>
            <Layers className="w-4 h-4 text-zinc-300" />
          </div>
          <div className="text-3xl font-black text-white mt-2">{totalUnits} Units</div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>Decomposed across 4 SKUs</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Floor Staff Response Team</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-white mt-2">4 Active</div>
          <div className="text-[11px] text-emerald-400 mt-1">
            <span>All zones covered</span>
          </div>
        </div>

      </div>

      {/* 2x2 Quadrant Grid Visualizer */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Physical Shelf Zone Occupancy Matrix</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/30 flex items-center justify-between">
            <div>
              <div className="text-xs text-amber-400 font-bold uppercase">Top-Left Deck</div>
              <div className="text-lg font-black text-white mt-0.5">Lay's Classic Chips</div>
              <div className="text-xs text-slate-400">Designated SKU: Lay's</div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                100% COMPLIANT
              </span>
              <div className="text-xs text-slate-400 mt-1 font-mono">1 Count</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/30 flex items-center justify-between">
            <div>
              <div className="text-xs text-rose-400 font-bold uppercase">Top-Right Deck</div>
              <div className="text-lg font-black text-white mt-0.5">Coca-Cola Original</div>
              <div className="text-xs text-slate-400">Designated SKU: CocaCola</div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                100% COMPLIANT
              </span>
              <div className="text-xs text-slate-400 mt-1 font-mono">1 Count</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50 flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-300 font-bold uppercase">Bottom-Left Shelf</div>
              <div className="text-lg font-black text-white mt-0.5">KitKat Wafer Cluster</div>
              <div className="text-xs text-slate-400">Designated SKU: KitKat</div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                100% COMPLIANT
              </span>
              <div className="text-xs text-slate-400 mt-1 font-mono">3 Units (Decomposed)</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-sky-500/[0.06] border border-sky-500/30 flex items-center justify-between">
            <div>
              <div className="text-xs text-sky-400 font-bold uppercase">Bottom-Right Shelf</div>
              <div className="text-lg font-black text-white mt-0.5">Oreo Vanilla Creme</div>
              <div className="text-xs text-slate-400">Designated SKU: Oreo</div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                100% COMPLIANT
              </span>
              <div className="text-xs text-slate-400 mt-1 font-mono">1 Count</div>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}

