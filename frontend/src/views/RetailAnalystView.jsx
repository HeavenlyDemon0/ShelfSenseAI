import React from 'react'
import { 
  LineChart, 
  BarChart3, 
  PieChart, 
  Download, 
  TrendingUp, 
  FileSpreadsheet,
  Layers
} from 'lucide-react'
import confetti from 'canvas-confetti'

export default function RetailAnalystView({ state }) {
  const complianceTrend = [92, 94, 95, 91, 89, 95, 98, 97, 99, 96, 100, 100]
  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', 'Now']

  const handleExportCSV = () => {
    const csv = "data:text/csv;charset=utf-8,Timestamp,Zone,SKU,UnitCount,ComplianceStatus\n" +
      `${new Date().toISOString()},TOP_LEFT,Lays,1,COMPLIANT\n` +
      `${new Date().toISOString()},TOP_RIGHT,CocaCola,1,COMPLIANT\n` +
      `${new Date().toISOString()},BOTTOM_LEFT,KitKat,3,COMPLIANT\n` +
      `${new Date().toISOString()},BOTTOM_RIGHT,Oreo,1,COMPLIANT\n`

    const link = document.createElement('a')
    link.href = encodeURI(csv)
    link.download = `shelfsense_bi_analytics_${Date.now()}.csv`
    link.click()
    confetti({ particleCount: 30, spread: 50 })
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LineChart className="w-5 h-5 text-zinc-300" />
            <h1 className="text-2xl font-black text-white tracking-tight">Retail Intelligence &amp; Friction Analytics</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-zinc-200 border border-white/20">
              Longitudinal BI
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            Planogram variance patterns, high-friction customer displacement hours, and longitudinal compliance trends.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="btn-tactile-white text-xs flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export BI Telemetry (CSV)</span>
        </button>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Compliance Trend Chart */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>24-Hour Compliance Velocity</span>
            </h3>
            <span className="text-xs text-emerald-400 font-bold">Current: 100%</span>
          </div>

          <div className="h-56 relative flex items-end justify-between gap-2 pt-6">
            {complianceTrend.map((val, i) => {
              const heightPct = ((val - 80) / 20) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                    {val}%
                  </div>
                  <div 
                    style={{ height: `${heightPct}%` }}
                    className="w-full rounded-t-md bg-gradient-to-t from-indigo-600/40 via-cyan-500/60 to-cyan-400 group-hover:to-white transition-all shadow-lg shadow-cyan-500/20"
                  />
                  <span className="text-[9px] text-slate-500 font-mono rotate-45 sm:rotate-0 mt-1">
                    {hours[i]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Zone Friction Index */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-zinc-300" />
            <span>Zone Misplacement Friction Index</span>
          </h3>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-amber-300 font-semibold">Top-Left Deck (Lay's)</span>
                <span className="text-slate-400">1 incident (16%)</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400 w-[16%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-200 font-semibold">Bottom-Left Shelf (KitKat)</span>
                <span className="text-slate-400">3 incidents (50%)</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-zinc-300 w-[50%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-rose-300 font-semibold">Top-Right Deck (Coca-Cola)</span>
                <span className="text-slate-400">1 incident (17%)</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-rose-400 w-[17%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-sky-300 font-semibold">Bottom-Right Shelf (Oreo)</span>
                <span className="text-slate-400">1 incident (17%)</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-sky-400 w-[17%]" />
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] text-zinc-300 leading-relaxed">
            <strong>Analyst Takeaway:</strong> KitKat exhibits the highest placement volatility due to compact snack grab-and-replace behavior.
          </div>
        </div>

      </div>

    </div>
  )
}

