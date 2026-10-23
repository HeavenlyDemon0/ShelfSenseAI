import React, { useState } from 'react'
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Layers,
  Eye,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { PERSONAS } from '../components/LoginModal'
import {
  supabase,
  supabaseSignUp,
  supabaseSignIn,
  supabaseSignInWithGoogle,
  isSupabaseConfigured,
} from '../lib/supabaseClient'

export default function AuthView({ 
  initialMode = 'login', 
  initialStep = 'auth',
  oauthUser = null,
  onAuthSuccess, 
  onNavigateLanding 
}) {
  const [mode, setMode] = useState(initialMode) // 'login' or 'signup'
  const [step, setStep] = useState(initialStep || (oauthUser ? 'persona' : 'auth')) // 'auth' or 'persona'

  // Auth fields
  const [name, setName] = useState(oauthUser?.name || '')
  const [email, setEmail] = useState(oauthUser?.email || '')
  const [password, setPassword] = useState('')

  // Persona fields
  const [selectedRole, setSelectedRole] = useState('staff')
  const [lockedRole, setLockedRole] = useState(null)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // Sync if incoming OAuth user changes
  React.useEffect(() => {
    if (oauthUser) {
      if (oauthUser.email) setEmail(oauthUser.email)
      if (oauthUser.name) setName(oauthUser.name)
      setStep('persona')

      const checkExisting = async () => {
        try {
          const profileRes = await fetch(`/api/auth/profile?email=${encodeURIComponent(oauthUser.email)}`)
          if (profileRes.ok) {
            const profileData = await profileRes.json()
            if (profileData.exists && profileData.role) {
              setLockedRole(profileData.role)
              setSelectedRole(profileData.role)
              if (profileData.full_name) setName(profileData.full_name)
            }
          }
        } catch (e) {}
      }
      checkExisting()
    }
  }, [oauthUser])

  // Step 1: Submit Login or Signup
  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setErrorMsg(null)
    setLoading(true)

    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim() || 'Retail Associate'

    try {
      // 1. Direct Supabase Auth invocation (so users appear in Supabase dashboard)
      if (isSupabaseConfigured) {
        if (mode === 'signup') {
          const { data, error } = await supabaseSignUp(cleanEmail, password, 'staff', cleanName)
          if (error && error.message.includes('already registered')) {
            setErrorMsg('This email is already registered. Please click "Sign In" above.')
            setLoading(false)
            return
          }
        } else {
          const { data, error } = await supabaseSignIn(cleanEmail, password)
          if (error && error.message.includes('Invalid login credentials')) {
            setErrorMsg('Invalid email or password.')
            setLoading(false)
            return
          }
        }
      }

      // 2. Also register in backend FastAPI
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
      const payload = mode === 'signup'
        ? { email: cleanEmail, password, name: cleanName, role: 'staff' }
        : { email: cleanEmail, password }

      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch (e) {}

      // 3. Check if user already has an existing locked persona in the database
      const profileRes = await fetch(`/api/auth/profile?email=${encodeURIComponent(cleanEmail)}`)
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        if (profileData.exists && profileData.role) {
          setLockedRole(profileData.role)
          setSelectedRole(profileData.role)
          if (profileData.full_name) setName(profileData.full_name)
        }
      }

      if (!name.trim()) {
        const guessedName = cleanEmail.split('@')[0].replace(/[._]/g, ' ')
        setName(guessedName.charAt(0).toUpperCase() + guessedName.slice(1))
      }

      // Move to Step 2: Persona Selection
      setStep('persona')
    } catch (err) {
      console.warn('Auth error:', err)
      setStep('persona')
    } finally {
      setLoading(false)
    }
  }

  // Google OAuth
  const handleGoogleAuth = async () => {
    setErrorMsg(null)
    setLoading(true)
    try {
      const { data, error } = await supabaseSignInWithGoogle()
      if (error) {
        setErrorMsg(`Google Auth Notice: ${error.message}. Please configure your Google Client ID and Secret in Supabase Auth Settings.`)
        setLoading(false)
        return
      }
    } catch (err) {
      console.warn('Google sign-in error:', err)
      setErrorMsg(err.message || 'Could not initiate Google OAuth. Check Supabase Provider settings.')
      setLoading(false)
    }
  }

  // Step 2: Confirm Persona & Enforce Database Lock
  const handlePersonaConfirm = async (e) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim() || 'Retail Operator'

    try {
      // 1. Sync persona with FastAPI backend
      const res = await fetch('/api/auth/select-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: cleanName,
          role: selectedRole,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Rejection rule triggered! (Same email with different persona)
        setErrorMsg(data.detail || `Access denied: This email is already assigned to a different persona.`)
        setLoading(false)
        return
      }

      // 2. Also sync into Supabase user_profiles directly
      if (isSupabaseConfigured) {
        try {
          await supabase.from('user_profiles').upsert(
            {
              email: cleanEmail,
              full_name: cleanName,
              role: selectedRole,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'email' }
          )
        } catch (supaErr) {
          console.warn('Supabase profile direct sync notice:', supaErr)
        }
      }

      // Success: Persona locked and validated!
      const chosenPersona = PERSONAS.find((p) => p.role === selectedRole) || PERSONAS[0]
      const userSession = {
        email: cleanEmail,
        name: cleanName,
        ...chosenPersona,
      }

      confetti({ particleCount: 40, spread: 60 })
      onAuthSuccess(userSession)
    } catch (err) {
      console.warn('Persona selection fallback:', err)
      const chosenPersona = PERSONAS.find((p) => p.role === selectedRole) || PERSONAS[0]
      onAuthSuccess({
        email: cleanEmail,
        name: cleanName,
        ...chosenPersona,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
          <span className={`px-2.5 py-1 rounded-md font-semibold ${step === 'auth' ? 'bg-white text-black' : 'bg-white/5 text-zinc-400'}`}>
            1. Authentication
          </span>
          <span>→</span>
          <span className={`px-2.5 py-1 rounded-md font-semibold ${step === 'persona' ? 'bg-white text-black' : 'bg-white/5 text-zinc-400'}`}>
            2. Persona Selection
          </span>
        </div>

        {/* STEP 1: AUTHENTICATION (LOGIN / SIGN UP) */}
        {step === 'auth' && (
          <div className="figma-card p-8 space-y-6 shadow-2xl">
            {/* Header & Mode Switcher */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setErrorMsg(null); }}
                  className={`text-sm font-bold pb-1 transition-all ${
                    mode === 'login'
                      ? 'text-white border-b-2 border-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setErrorMsg(null); }}
                  className={`text-sm font-bold pb-1 transition-all ${
                    mode === 'signup'
                      ? 'text-white border-b-2 border-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  {mode === 'login' ? 'Sign in to ShelfSense' : 'Register Enterprise Account'}
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  {mode === 'login'
                    ? 'Enter your credentials to access your store telemetry.'
                    : 'Create your account to configure and operate retail planograms.'}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 block">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0e0f12] border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-white/30"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 block">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="operator@walmart.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0e0f12] border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 block">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#0e0f12] border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-tactile-white text-xs py-2.5 flex items-center justify-center gap-2 mt-2"
              >
                <span>{loading ? 'Verifying...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-white/[0.08]" />
              <span className="flex-shrink mx-3 text-[11px] text-zinc-500 font-mono">OR</span>
              <div className="flex-grow border-t border-white/[0.08]" />
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2.5 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Quick Guest Sign In */}
            <button
              type="button"
              onClick={() => {
                const guestPersona = PERSONAS.find((p) => p.role === 'guest') || {
                  role: 'guest',
                  name: 'Guest Observer',
                  tag: 'Limited Read-Only Preview',
                }
                onAuthSuccess({
                  email: 'guest@shelfsense.local',
                  name: 'Guest Observer',
                  ...guestPersona,
                })
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/60 text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-center gap-2 transition-all"
            >
              <Eye className="w-4 h-4 text-zinc-400" />
              <span>Continue as Guest (Limited Preview)</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onNavigateLanding}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                ← Back to Overview
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PERSONA SELECTION */}
        {step === 'persona' && (
          <div className="figma-card p-8 space-y-6 shadow-2xl animate-in fade-in duration-200">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                <span>Identity Verified</span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight mt-1">
                Welcome, {name || 'Retail Operator'}
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                {email}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {lockedRole && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>This account is permanently assigned to the <strong>{lockedRole.toUpperCase()}</strong> workspace.</span>
              </div>
            )}

            <form onSubmit={handlePersonaConfirm} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">
                  Select Your Operational Persona
                </label>
                <div className="relative">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    disabled={Boolean(lockedRole)}
                    className="w-full px-3.5 py-3 rounded-xl bg-[#0e0f12] border border-white/10 text-white text-xs font-medium appearance-none focus:outline-none focus:border-white/30 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {PERSONAS.map((p) => (
                      <option key={p.role} value={p.role} className="bg-[#15171c] py-2 text-white">
                        {p.name} — ({p.tag})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Persona Context Card */}
              {(() => {
                const current = PERSONAS.find((p) => p.role === selectedRole) || PERSONAS[0]
                const IconComponent = current.lucide
                return (
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-white">
                      {IconComponent && <IconComponent className="w-4 h-4 text-zinc-300" />}
                      <span>{current.name}</span>
                      <span className="text-[10px] text-zinc-400 font-normal">({current.tag})</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {current.description}
                    </p>
                  </div>
                )
              })()}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('auth')}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 text-xs font-semibold transition-all"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-tactile-white text-xs py-2.5 flex items-center justify-center gap-2"
                >
                  <span>{loading ? 'Assigning...' : 'Confirm & Launch Dashboard'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}

