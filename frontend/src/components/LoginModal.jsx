import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Sparkles, 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  ShoppingCart, 
  Store, 
  Boxes, 
  LineChart, 
  Cpu,
  Eye
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabaseSignIn, supabaseSignUp, isSupabaseConfigured } from '../lib/supabaseClient'

export const PERSONAS = [
  {
    role: 'staff',
    name: 'Floor Staff',
    lucide: ShoppingCart,
    tag: 'Restock & Remediation',
    description: 'Instant visual alerts for misplaced products with neighbor item guidance & one-click resolution.',
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-300'
  },
  {
    role: 'manager',
    name: 'Store Manager',
    lucide: Store,
    tag: 'Operations & KPIs',
    description: 'Real-time store compliance scorecard, shift resolution MTTR, and physical zone heatmaps.',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300'
  },
  {
    role: 'inventory',
    name: 'Inventory Controller',
    lucide: Boxes,
    tag: 'SKU & Multi-Pack Accounting',
    description: 'Unit reconciliation with multi-pack stack decomposition (3 KitKats per cluster) and replenishment drafts.',
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-300'
  },
  {
    role: 'analyst',
    name: 'Retail Analyst',
    lucide: LineChart,
    tag: 'BI & Friction Analytics',
    description: 'Longitudinal 24h compliance curves, customer quadrant friction index, and audit CSV exports.',
    color: 'from-zinc-500/20 to-slate-500/20 border-zinc-500/40 text-zinc-300'
  },
  {
    role: 'admin',
    name: 'Administrator & Dev',
    lucide: Cpu,
    tag: 'Full Vision Command Center',
    description: 'Live webcam HUD, 3D Digital Twin (Three.js), Planogram CAD boundary calibrator, and raw YOLO telemetry.',
    color: 'from-cyan-500/20 to-indigo-500/20 border-cyan-500/40 text-cyan-300'
  },
  {
    role: 'guest',
    name: 'Guest Observer',
    lucide: Eye,
    tag: 'Limited Read-Only Preview',
    description: 'Explore live store compliance telemetry and 3D digital twin. Administrative calibrations and camera hardware are locked.',
    color: 'from-zinc-600/20 to-slate-700/20 border-zinc-600/40 text-zinc-300'
  }
]

export default function LoginModal({ isOpen, onClose, onSelectPersona }) {
  const [selectedRole, setSelectedRole] = useState(PERSONAS[0].role)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    const chosen = PERSONAS.find(p => p.role === selectedRole) || PERSONAS[0]

    // If Supabase is configured and valid email provided, authenticate with live Supabase Auth
    if (isSupabaseConfigured && email.includes('@') && password.length >= 6) {
      try {
        const { data: signInData, error: signInError } = await supabaseSignIn(email, password)
        if (signInError && signInError.message.includes('Invalid login credentials')) {
          // If account doesn't exist yet, sign up automatically
          await supabaseSignUp(email, password, chosen.role, chosen.name)
        }
      } catch (err) {
        console.warn('Supabase auth attempt:', err)
      }
    }

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 }
    })
    setLoading(false)
    onSelectPersona(chosen)
    onClose()
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-[#0b0f19] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/10 overflow-hidden"
        >
          {/* Ambient background glow inside modal */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-cyan-500/10 via-indigo-500/10 to-transparent blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Adaptive Operational Gateway</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sign In &amp; Choose Persona
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              ShelfSense customizes available telemetry, alert feeds, and controls according to your role.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Persona Picker Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Select Operational Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
                {PERSONAS.map(p => {
                  const isSelected = selectedRole === p.role
                  return (
                    <div
                      key={p.role}
                      onClick={() => setSelectedRole(p.role)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? `bg-gradient-to-r ${p.color} border-white/30 shadow-lg shadow-indigo-500/10 scale-[1.01]`
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{p.icon}</span>
                          <span className="font-bold text-sm text-white">{p.name}</span>
                        </div>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                        )}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-300">{p.tag}</div>
                      <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                        {p.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Simulated Credentials */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Enter Credentials <span className="text-slate-500 font-normal lowercase">(any value accepted for prototype)</span>
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@shelfsense.ai"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-between gap-4">
              <span className="text-[11px] text-zinc-500 hidden sm:inline">
                Encrypted Supabase Auth Integration
              </span>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs tracking-wide shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>{loading ? 'Authenticating...' : 'Enter Persona Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

