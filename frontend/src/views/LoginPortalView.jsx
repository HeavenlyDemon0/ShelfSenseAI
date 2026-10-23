import React, { useState } from 'react'
import {
  ShoppingCart,
  Store,
  Boxes,
  LineChart,
  Cpu,
  ArrowRight,
  ShieldCheck,
  Lock,
  Mail,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Database,
  Layers,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabaseSignIn, supabaseSignUp, isSupabaseConfigured } from '../lib/supabaseClient'
import { PERSONAS } from '../components/LoginModal'

export default function LoginPortalView({ currentPersona, onSelectPersona, onNavigateOverview }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [customRole, setCustomRole] = useState('staff')
  const [loading, setLoading] = useState(false)
  const [authMsg, setAuthMsg] = useState(null)

  const handleInstantSelect = (persona) => {
    confetti({ particleCount: 35, spread: 55 })
    onSelectPersona(persona)
  }

  const handleCustomAuth = async (e) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    setAuthMsg(null)

    const chosen = PERSONAS.find((p) => p.role === customRole) || PERSONAS[0]

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabaseSignIn(email, password)
        if (error && error.message.includes('Invalid login credentials')) {
          // Auto sign-up if first time
          await supabaseSignUp(email, password, chosen.role, chosen.name)
        }
      } catch (err) {
        console.warn('Auth fallback:', err)
      }
    }

    confetti({ particleCount: 50, spread: 70 })
    setLoading(false)
    onSelectPersona(chosen)
  }

  return (
    <div className="space-y-12 pb-24 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3 pt-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-zinc-300 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
          <span>Role-Based Access Control • 5 Specialized Retail Workspaces</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
          Choose Your Persona Portal
        </h1>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto">
          ShelfSense tailors its computer vision telemetry and planogram tools to specific operational responsibilities.
        </p>
      </div>

      {/* 5 Persona Cards in Figma Community Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PERSONAS.map((persona) => {
          const isCurrent = currentPersona?.role === persona.role

          // Custom card styling inspired by Figma Community covers
          let coverBg = 'bg-[#1c1f26]'
          let accentPill = 'bg-white/10 text-white'
          let tagColor = 'text-zinc-400'

          if (persona.role === 'staff') {
            coverBg = 'bg-gradient-to-br from-[#d97706] to-[#b45309]'
            accentPill = 'bg-amber-950/60 text-amber-200 border border-amber-400/30'
            tagColor = 'text-amber-400'
          } else if (persona.role === 'manager') {
            coverBg = 'bg-gradient-to-br from-[#059669] to-[#047857]'
            accentPill = 'bg-emerald-950/60 text-emerald-200 border border-emerald-400/30'
            tagColor = 'text-emerald-400'
          } else if (persona.role === 'inventory') {
            coverBg = 'bg-gradient-to-br from-[#0062ad] to-[#0047d9]'
            accentPill = 'bg-blue-950/60 text-blue-200 border border-blue-400/30'
            tagColor = 'text-blue-400'
          } else if (persona.role === 'analyst') {
            coverBg = 'bg-gradient-to-br from-[#ff5c35] to-[#c2410c]'
            accentPill = 'bg-orange-950/60 text-orange-200 border border-orange-400/30'
            tagColor = 'text-orange-400'
          } else if (persona.role === 'admin') {
            coverBg = 'bg-gradient-to-br from-[#27272a] via-[#18181b] to-[#09090b]'
            accentPill = 'bg-zinc-800 text-zinc-200 border border-zinc-600/50'
            tagColor = 'text-zinc-300'
          }

          return (
            <div
              key={persona.role}
              className={`figma-card flex flex-col justify-between overflow-hidden group cursor-pointer ${
                isCurrent ? 'ring-2 ring-white/40' : ''
              }`}
              onClick={() => handleInstantSelect(persona)}
            >
              <div>
                {/* Visual Cover Header */}
                <div className={`h-36 ${coverBg} relative p-5 flex flex-col justify-between overflow-hidden`}>
                  <div className="flex justify-between items-start z-10">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide uppercase ${accentPill}`}>
                      {persona.tag}
                    </span>
                    <span className="text-2xl drop-shadow-md">{persona.icon}</span>
                  </div>

                  <div className="z-10">
                    <h3 className="text-xl font-black text-white tracking-tight drop-shadow-sm">
                      {persona.name}
                    </h3>
                  </div>

                  {/* Decorative background shape */}
                  <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-3">
                  <p className="text-xs text-zinc-300 leading-relaxed min-h-[48px]">
                    {persona.description}
                  </p>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                    <span className={`font-semibold ${tagColor}`}>Dedicated Workspace</span>
                    {isCurrent ? (
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="text-zinc-500 font-mono">Ready</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-5 pt-0">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white text-zinc-200 hover:text-black font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all group-hover:bg-white group-hover:text-black"
                >
                  <span>Enter as {persona.name}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          )
        })}

        {/* 6th Card: Custom Supabase Credentials Card */}
        <div className="figma-card flex flex-col justify-between overflow-hidden">
          <div className="h-36 bg-[#16171b] border-b border-white/[0.06] p-5 flex flex-col justify-between relative">
            <div className="flex justify-between items-start">
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                Enterprise Auth
              </span>
              <Database className="w-5 h-5 text-zinc-400" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Operator Login</h3>
              <p className="text-[11px] text-zinc-400">Authenticate via Supabase Database</p>
            </div>
          </div>

          <form onSubmit={handleCustomAuth} className="p-5 space-y-3">
            <div>
              <input
                type="email"
                placeholder="operator@retailer.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <select
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-300"
              >
                {PERSONAS.map((p) => (
                  <option key={p.role} value={p.role}>
                    Role: {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In with Supabase'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

