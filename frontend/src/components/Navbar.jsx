import React from 'react'
import { 
  Scan, 
  SlidersHorizontal,
  LogOut, 
  Database,
  User,
  LayoutDashboard,
} from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabaseClient'

export default function Navbar({ 
  currentPersona, 
  onOpenAuth, 
  onLogout, 
  activeTab, 
  setActiveTab,
}) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0e0f12]/90 border-b border-white/[0.08] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div 
          onClick={() => setActiveTab('landing')} 
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
            <Scan className="w-4 h-4 text-black" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1">
              ShelfSense<span className="text-zinc-400 font-mono font-medium text-xs">.ai</span>
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono -mt-1">
              Unified Edge Vision v4.2
            </span>
          </div>
        </div>

        {/* Centered Tabs (Only visible when user is in Dashboard mode) */}
        {currentPersona && activeTab !== 'landing' && activeTab !== 'auth' && (
          <nav className="hidden md:flex items-center gap-1 bg-[#15171c] p-1 rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard ({currentPersona.name})</span>
            </button>

            {currentPersona.role === 'admin' && (
              <button
                onClick={() => setActiveTab('planogram')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'planogram'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Planogram CAD</span>
              </button>
            )}
          </nav>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          
          {/* Supabase status badge */}
          <div 
            title={isSupabaseConfigured ? "Supabase Cloud Database Connected" : "Local Storage Mode"} 
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/[0.03] border border-white/[0.07]"
          >
            <Database className="w-3 h-3 text-zinc-400" />
            <span className="text-zinc-400">DB:</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            <span className={isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}>
              {isSupabaseConfigured ? 'Sync' : 'Local'}
            </span>
          </div>

          {/* User Persona or Auth Actions: On landing page, ALWAYS show pure Log In & Sign Up */}
          {currentPersona && activeTab !== 'landing' ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs font-semibold">
                <User className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden sm:inline">{currentPersona.userName || currentPersona.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-zinc-300 font-mono">
                  {currentPersona.name}
                </span>
              </div>

              <button
                onClick={onLogout}
                title="Log Out"
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* INITIALLY & ON LANDING: ONLY LOGIN AND SIGN UP BUTTONS */
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 hover:text-white text-xs font-semibold transition-all border border-white/10"
              >
                Log In
              </button>

              <button
                onClick={() => onOpenAuth('signup')}
                className="btn-tactile-white text-xs py-1.5 px-4"
              >
                Sign Up
              </button>
            </div>
          )}

        </div>

      </div>
    </header>
  )
}
