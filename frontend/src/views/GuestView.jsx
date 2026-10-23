import React, { useState } from 'react'
import {
  Eye,
  Lock,
  ShieldAlert,
  CheckCircle2,
  SlidersHorizontal,
  Camera,
  Boxes,
  Layers,
  ArrowRight,
  Rotate3d,
  Sparkles,
  Info,
} from 'lucide-react'
import DigitalTwin3D from '../components/DigitalTwin3D'
import ReplenishmentQueue from '../components/ReplenishmentQueue'

export default function GuestView({ state, planogram, onOpenAuth }) {
  const [activeTab, setActiveTab] = useState('twin3d') // 'overview', 'twin3d', 'replenishment'
  const [showLockNotice, setShowLockNotice] = useState(null)

  const compliancePct = state?.compliance_pct ?? 100
  const misplacedCount = state?.misplaced_count ?? 0
  const products = state?.products || { CocaCola: 1, KitKat: 3, Lays: 1, Oreo: 1 }
  const totalUnits = Object.values(products).reduce((a, b) => a + b, 0)
  const alerts = state?.alerts || []

  const handleRestrictedAction = (featureName) => {
    setShowLockNotice(`Action Restricted: '${featureName}' is locked in Guest Observer mode. Sign in to unlock full enterprise control.`)
    setTimeout(() => setShowLockNotice(null), 4500)
  }

  return (
    <div className="space-y-6 pb-20">
      
      {/* Guest Mode Notice Banner */}
      <div className="figma-card p-5 border-amber-500/30 bg-amber-500/[0.04]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Eye className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Guest Observer Mode — Limited Feature Preview
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  READ-ONLY
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                You have preview access to the 3D Digital Twin, live shelf compliance, and replenishment velocities. Hardware camera activation, CAD coordinate recalibration, alert resolution, and few-shot SKU enrollment require authenticated access.
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenAuth('login')}
            className="btn-tactile-white text-xs flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <span>Sign In for Full Access</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showLockNotice && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center gap-2 animate-in fade-in duration-200">
          <Lock className="w-4 h-4 shrink-0" />
          <span>{showLockNotice}</span>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="figma-card p-5">
          <span className="text-xs text-zinc-400 block">Planogram Compliance</span>
          <div className="text-3xl font-black text-white font-mono mt-1">{compliancePct}%</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Telemetry verified</span>
          </div>
        </div>

        <div className="figma-card p-5">
          <span className="text-xs text-zinc-400 block">Total Shelf Inventory</span>
          <div className="text-3xl font-black text-white font-mono mt-1">{totalUnits} Units</div>
          <div className="text-[11px] text-zinc-400 mt-1">4 Authoritative Classes</div>
        </div>

        <div className="figma-card p-5">
          <span className="text-xs text-zinc-400 block">Misplaced Items</span>
          <div className="text-3xl font-black text-zinc-200 font-mono mt-1">{misplacedCount}</div>
          <div className="text-[11px] text-zinc-400 mt-1">Spatial departure status</div>
        </div>

        <div className="figma-card p-5">
          <span className="text-xs text-zinc-400 block">Active Alerts</span>
          <div className="text-3xl font-black text-amber-300 font-mono mt-1">{alerts.length}</div>
          <div className="text-[11px] text-zinc-400 mt-1">Read-only notification feed</div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1">
        <button
          onClick={() => setActiveTab('twin3d')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'twin3d'
              ? 'bg-white text-black shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Rotate3d className="w-3.5 h-3.5" />
          <span>Interactive 3D Digital Twin</span>
        </button>

        <button
          onClick={() => setActiveTab('replenishment')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'replenishment'
              ? 'bg-white text-black shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>AI Replenishment Queue</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'overview'
              ? 'bg-white text-black shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Shelf Allocation &amp; Stock</span>
        </button>
      </div>

      {/* Tab 1: 3D Digital Twin (Guest Preview) */}
      {activeTab === 'twin3d' && (
        <div className="space-y-4">
          <DigitalTwin3D state={state} />
        </div>
      )}

      {/* Tab 2: AI Replenishment Queue (Guest Preview) */}
      {activeTab === 'replenishment' && (
        <div className="space-y-4">
          <ReplenishmentQueue />
        </div>
      )}

      {/* Tab 3: Shelf Allocation Breakdown */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="figma-card p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Top-Left Deck</span>
            <h4 className="text-base font-bold text-white mt-1">Lay's Classic Chips</h4>
            <div className="text-2xl font-black font-mono text-white mt-2">{products.Lays || 0} Pack</div>
            <span className="text-[11px] text-zinc-400 block mt-1">Designated: Snacks</span>
          </div>

          <div className="figma-card p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Top-Right Deck</span>
            <h4 className="text-base font-bold text-white mt-1">Coca-Cola Can</h4>
            <div className="text-2xl font-black font-mono text-white mt-2">{products.CocaCola || 0} Unit</div>
            <span className="text-[11px] text-zinc-400 block mt-1">Designated: Beverages</span>
          </div>

          <div className="figma-card p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">Bottom-Left Shelf</span>
            <h4 className="text-base font-bold text-white mt-1">KitKat 3-Bar Stack</h4>
            <div className="text-2xl font-black font-mono text-white mt-2">{products.KitKat || 0} Units</div>
            <span className="text-[11px] text-zinc-400 block mt-1">Cluster Decomposed</span>
          </div>

          <div className="figma-card p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Bottom-Right Shelf</span>
            <h4 className="text-base font-bold text-white mt-1">Oreo Cookies Pack</h4>
            <div className="text-2xl font-black font-mono text-white mt-2">{products.Oreo || 0} Unit</div>
            <span className="text-[11px] text-zinc-400 block mt-1">Designated: Biscuits</span>
          </div>
        </div>
      )}

      {/* Restricted Enterprise Features Showcase (Demonstrates locked features) */}
      <div className="figma-card p-6 space-y-4 border-dashed">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-zinc-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Enterprise Administrative Modules (Locked in Guest Mode)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => handleRestrictedAction('DirectShow Hardware Camera HUD')}
            className="p-4 rounded-xl bg-white/[0.02] border border-white/5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <Camera className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
              <Lock className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <h4 className="text-sm font-bold text-white mt-2">Hardware Camera Stream</h4>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
              Live webcam DirectShow acquisition and sub-second bounding box overlay HUD.
            </p>
          </div>

          <div
            onClick={() => handleRestrictedAction('Planogram CAD Boundary Tuner')}
            className="p-4 rounded-xl bg-white/[0.02] border border-white/5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <SlidersHorizontal className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
              <Lock className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <h4 className="text-sm font-bold text-white mt-2">Planogram CAD Tuner</h4>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
              Sub-pixel partition boundary calibrator to adjust physical shelf coordinates.
            </p>
          </div>

          <div
            onClick={() => handleRestrictedAction('Few-Shot Online Learning Studio')}
            className="p-4 rounded-xl bg-white/[0.02] border border-white/5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <Boxes className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
              <Lock className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <h4 className="text-sm font-bold text-white mt-2">Few-Shot Object Enrollment</h4>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
              Metric projection head and continual online fine-tuning for novel retail items.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

