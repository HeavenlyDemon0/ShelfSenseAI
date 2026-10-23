import React, { useState, useEffect } from 'react'
import Fluid3DBackground from './components/Fluid3DBackground'
import Navbar from './components/Navbar'
import LandingPage from './components/LandingPage'
import AuthView from './views/AuthView'
import FloorStaffView from './views/FloorStaffView'
import StoreManagerView from './views/StoreManagerView'
import InventoryControllerView from './views/InventoryControllerView'
import RetailAnalystView from './views/RetailAnalystView'
import AdminDevView from './views/AdminDevView'
import GuestView from './views/GuestView'
import PlanogramCadView from './views/PlanogramCadView'
import { PERSONAS } from './components/LoginModal'
import { supabase, isSupabaseConfigured, supabaseSignOut } from './lib/supabaseClient'

export default function App() {
  const [activeTab, setActiveTab] = useState('landing') // 'landing', 'auth', 'dashboard', 'planogram'
  const [authMode, setAuthMode] = useState('login') // 'login' or 'signup'
  
  // Initially, NO ONE is logged in and NO persona is active
  const [currentPersona, setCurrentPersona] = useState(null)
  const [oauthUser, setOauthUser] = useState(null)

  const [engineState, setEngineState] = useState(null)
  const [planogram, setPlanogram] = useState(null)
  const [loading, setLoading] = useState(false)

  // Fetch initial telemetry and physical shelf state
  const fetchShelfState = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/shelf-test', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.state) {
          setEngineState(data.state)
          setPlanogram(data.state.planogram)
        }
      }
    } catch (err) {
      console.warn('Initial shelf scan fallback:', err)
      // Local fallback state matching physical test shelf
      setEngineState({
        compliance_pct: 100,
        misplaced_count: 0,
        products: { CocaCola: 1, KitKat: 3, Lays: 1, Oreo: 1 },
        fps: 20.7,
        detections: [
          { track_id: 100, class_name: 'Lays', confidence: 0.91, bbox: [110, 85, 410, 480], actual_zone_name: 'Top-Left Deck' },
          { track_id: 102, class_name: 'CocaCola', confidence: 0.93, bbox: [820, 95, 1150, 520], actual_zone_name: 'Top-Right Deck' },
          { track_id: 130, class_name: 'KitKat', confidence: 0.94, bbox: [120, 680, 460, 920], actual_zone_name: 'Bottom-Left Shelf' },
          { track_id: 128, class_name: 'Oreo', confidence: 0.88, bbox: [840, 710, 1180, 950], actual_zone_name: 'Bottom-Right Shelf' }
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShelfState()
  }, [])

  // Catch Supabase OAuth redirect and existing authenticated sessions
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    // 1. Check existing session on mount (catches OAuth token in URL hash)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleIncomingAuthUser(session.user)
      }
    })

    // 2. Real-time auth state subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        handleIncomingAuthUser(session.user)
      } else if (event === 'SIGNED_OUT') {
        setCurrentPersona(null)
        setOauthUser(null)
        setActiveTab('landing')
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const handleIncomingAuthUser = async (user) => {
    const email = user.email?.trim().toLowerCase()
    const name = user.user_metadata?.full_name || user.user_metadata?.name || email?.split('@')[0] || 'Retail Operator'

    try {
      const res = await fetch(`/api/auth/profile?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const profile = await res.json()
        if (profile.exists && profile.role) {
          const persona = PERSONAS.find((p) => p.role === profile.role) || PERSONAS[0]
          const sessionData = {
            email,
            name: profile.full_name || name,
            ...persona,
          }
          setCurrentPersona(sessionData)
          localStorage.setItem('shelfsense_persona', JSON.stringify(sessionData))
          setActiveTab('dashboard')
          return
        }
      }
    } catch (e) {
      console.warn('Profile lookup error for OAuth user:', e)
    }

    // First-time OAuth user: Route straight to Step 2 Persona Selection
    setOauthUser({ email, name })
    setAuthMode('login')
    setActiveTab('auth')
  }

  const handleOpenAuth = (mode = 'login') => {
    setAuthMode(mode)
    setOauthUser(null)
    setActiveTab('auth')
  }

  const handleGuestLogin = () => {
    const guestPersona = PERSONAS.find((p) => p.role === 'guest') || {
      role: 'guest',
      name: 'Guest Observer',
      tag: 'Limited Read-Only Preview',
    }
    const guestSession = {
      email: 'guest@shelfsense.local',
      name: 'Guest Observer',
      ...guestPersona,
    }
    handleAuthSuccess(guestSession)
  }

  const handleAuthSuccess = (userSession) => {
    setCurrentPersona(userSession)
    localStorage.setItem('shelfsense_persona', JSON.stringify(userSession))
    setActiveTab('dashboard')
  }

  const handleLogout = async () => {
    localStorage.removeItem('shelfsense_persona')
    setCurrentPersona(null)
    setOauthUser(null)
    try {
      await supabaseSignOut()
    } catch (e) {}
    setActiveTab('landing')
  }

  const renderDashboardView = () => {
    if (!currentPersona) {
      return (
        <AuthView
          initialMode="login"
          onAuthSuccess={handleAuthSuccess}
          onNavigateLanding={() => setActiveTab('landing')}
        />
      )
    }

    switch (currentPersona.role) {
      case 'staff':
        return (
          <FloorStaffView
            state={engineState}
            planogram={planogram}
            onRefresh={fetchShelfState}
            loading={loading}
          />
        )
      case 'manager':
        return (
          <StoreManagerView
            state={engineState}
            planogram={planogram}
            onRefresh={fetchShelfState}
          />
        )
      case 'inventory':
        return (
          <InventoryControllerView
            state={engineState}
            onRefresh={fetchShelfState}
          />
        )
      case 'analyst':
        return (
          <RetailAnalystView
            state={engineState}
          />
        )
      case 'admin':
        return (
          <AdminDevView
            state={engineState}
            planogram={planogram}
            onRefresh={fetchShelfState}
            loading={loading}
          />
        )
      case 'guest':
        return (
          <GuestView
            state={engineState}
            planogram={planogram}
            onOpenAuth={handleOpenAuth}
          />
        )
      default:
        return (
          <FloorStaffView
            state={engineState}
            planogram={planogram}
            onRefresh={fetchShelfState}
            loading={loading}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0f12] text-zinc-100 relative selection:bg-white selection:text-black">
      {/* Figma Architectural Dot-Grid Canvas Background */}
      <Fluid3DBackground />

      {/* Shared Minimalist Navbar */}
      <Navbar
        currentPersona={currentPersona}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        {activeTab === 'landing' && (
          <LandingPage 
            onOpenAuth={handleOpenAuth} 
            onGuestLogin={handleGuestLogin}
          />
        )}

        {activeTab === 'auth' && (
          <AuthView
            initialMode={authMode}
            oauthUser={oauthUser}
            onAuthSuccess={handleAuthSuccess}
            onNavigateLanding={() => {
              setOauthUser(null)
              setActiveTab('landing')
            }}
          />
        )}

        {activeTab === 'dashboard' && renderDashboardView()}

        {activeTab === 'planogram' && <PlanogramCadView onApplied={fetchShelfState} />}
      </main>
    </div>
  )
}
