import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import AppBottomNav from './components/AppBottomNav.tsx'
import CapsuleView from './pages/CapsuleView.tsx'
import CapsuleInterior from './pages/CapsuleInterior.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Home from './pages/Home.tsx'
import PerfilPublico from './pages/PerfilPublico.tsx'
import InviteLanding from './pages/InviteLanding.tsx'
import InitialLoading from './pages/InitialLoading.tsx'
import Login from './pages/Login.tsx'
import Register from './pages/Register.tsx'
import RegisterDetails from './pages/RegisterDetails.tsx'
import RegisterConfirmation from './pages/RegisterConfirmation.tsx'
import StartAccess from './pages/StartAccess.tsx'
import UploadCapsule from './pages/UploadCapsule.tsx'
import Busqueda from './pages/Busqueda.tsx'
import CapsulesPage from './pages/CapsulesPage.tsx'
import TodasMisCapsulas from './pages/TodasMisCapsulas.tsx'
import CreateCapsuleFlowPage from './pages/CreateCapsuleFlowPage.tsx'
import CapsuleEditPage from './pages/CapsuleEditPage.tsx'
import SharedCapsuleView from './pages/SharedCapsuleView.tsx'
import MediaDetailPage from './pages/MediaDetailPage.tsx'
import MisAmigos from './pages/MisAmigos.tsx'
import PerfilAmigo from './pages/PerfilAmigo.tsx'
import MiPerfil from './pages/MiPerfil.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import SettingsAccountPage from './pages/SettingsAccountPage.tsx'
import SettingsPreferencesPage from './pages/SettingsPreferencesPage.tsx'
import SettingsSessionPage from './pages/SettingsSessionPage.tsx'
import { clearSession, fetchCurrentUser } from './services/api.ts'
import { applyStoredUserPreferences } from './services/userPreferences.ts'
import './styles/app.css'
import './styles/busqueda.css'
import './styles/home.css'
import './styles/capsule-view.css'
import './styles/capsule-interior.css'
import './styles/capsule-edit.css'
import './styles/shared-capsule-view.css'
import './styles/notification-bell.css'
import './styles/create-capsule.css'
import './styles/media-detail.css'

type GuardStatus = 'checking' | 'authenticated' | 'unauthenticated'

function AuthCheckingScreen() {
  return (
    <section className="page-layout" aria-label="Comprobando autenticacion">
      <p>Cargando...</p>
    </section>
  )
}

function RequireAuth() {
  const location = useLocation()
  const [status, setStatus] = useState<GuardStatus>('checking')

  useEffect(() => {
    let active = true

    const verify = async () => {
      const token = sessionStorage.getItem('authToken')

      if (!token) {
        if (active) setStatus('unauthenticated')
        return
      }

      try {
        await fetchCurrentUser()
        if (active) setStatus('authenticated')
      } catch {
        clearSession()
        if (active) setStatus('unauthenticated')
      }
    }

    verify()

    return () => {
      active = false
    }
  }, [location.pathname])

  if (status === 'checking') return <AuthCheckingScreen />
  if (status === 'unauthenticated') return <Navigate to="/login" replace />

  return <Outlet />
}

function RequireGuest() {
  const location = useLocation()
  const [status, setStatus] = useState<GuardStatus>('checking')

  useEffect(() => {
    let active = true

    const verify = async () => {
      const token = sessionStorage.getItem('authToken')

      if (!token) {
        if (active) setStatus('unauthenticated')
        return
      }

      try {
        await fetchCurrentUser()
        if (active) setStatus('authenticated')
      } catch {
        clearSession()
        if (active) setStatus('unauthenticated')
      }
    }

    verify()

    return () => {
      active = false
    }
  }, [location.pathname])

  if (status === 'checking') return <AuthCheckingScreen />
  if (status === 'authenticated') return <Navigate to="/inicio" replace />

  return <Outlet />
}

function AppLayout() {
  const location = useLocation()
  const hideNavbar = [
    '/',
    '/inicio-publico',
    '/inicio-registro',
    '/login',
    '/registro',
    '/inicio',
    '/buscar',
    '/mis-capsulas',
    '/amigos',
    '/perfil',
    '/ajustes',
    '/ajustes/cuenta',
    '/ajustes/preferencias',
    '/ajustes/sesion',
  ].includes(location.pathname) || location.pathname.match(/^\/capsulas\/[^/]+(\/interior|\/compartida|\/editar|\/media)/)

  // AppBottomNav is hidden on these paths — only add padding when it's visible
  const bottomNavHidden = ['/', '/inicio-publico', '/registro', '/login', '/inicio-registro'].includes(location.pathname)
    || location.pathname.startsWith('/capsulas/crear/')
  const bottomNavPadding = !bottomNavHidden
    ? 'calc(env(safe-area-inset-bottom, 16px) + 90px)'
    : undefined

  return (
    <div className="app-shell">
      <main
        className={`app-content ${hideNavbar ? 'app-content--auth' : ''}`}
        style={bottomNavPadding ? { paddingBottom: bottomNavPadding } : undefined}
      >
        <Routes>
          <Route path="/perfil/:username" element={<PerfilPublico />} />
          <Route path="/invite/:token" element={<InviteLanding />} />

          <Route path="/" element={<InitialLoading />} />
          <Route path="/inicio-publico" element={<Home />} />
          <Route path="/inicio-registro" element={<StartAccess />} />

          <Route element={<RequireGuest />}>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/registro/datos" element={<RegisterDetails />} />
            <Route path="/registro/confirmacion" element={<RegisterConfirmation />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="/inicio" element={<Dashboard />} />
            <Route path="/dashboard" element={<Navigate to="/inicio" replace />} />
            <Route path="/capsula" element={<CapsuleView />} />
            <Route path="/subir" element={<UploadCapsule />} />
            <Route path="/buscar" element={<Busqueda />} />
            <Route path="/capsulas" element={<CapsulesPage />} />
            <Route path="/crear-capsula" element={<CreateCapsuleFlowPage />} />
            <Route path="/capsulas/crear" element={<CreateCapsuleFlowPage />} />
            <Route path="/capsulas/crear/editor" element={<CapsuleEditPage />} />
            <Route path="/capsulas/:id" element={<CapsuleView />} />
            <Route path="/capsulas/:id/interior" element={<CapsuleInterior />} />
            <Route path="/capsulas/:id/compartida" element={<SharedCapsuleView />} />
            <Route path="/capsulas/:id/media/:mediaIndex" element={<MediaDetailPage />} />
            <Route path="/capsulas/:capsuleId/editar" element={<CapsuleEditPage />} />
            <Route path="/amigos" element={<MisAmigos />} />
            <Route path="/amigos/:amigoId" element={<PerfilAmigo />} />
            <Route path="/perfil" element={<MiPerfil />} />
            <Route path="/mis-capsulas" element={<TodasMisCapsulas />} />
            <Route path="/ajustes" element={<SettingsPage />} />
            <Route path="/ajustes/cuenta" element={<SettingsAccountPage />} />
            <Route path="/ajustes/preferencias" element={<SettingsPreferencesPage />} />
            <Route path="/ajustes/sesion" element={<SettingsSessionPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  useEffect(() => {
    applyStoredUserPreferences()

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'authUser') {
        applyStoredUserPreferences()
      }
    }

    const onAuthUserChanged = () => {
      applyStoredUserPreferences()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('authUserChanged', onAuthUserChanged as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('authUserChanged', onAuthUserChanged as EventListener)
    }
  }, [])

  return (
    <BrowserRouter>
      <AppLayout />
      <AppBottomNav />
    </BrowserRouter>
  )
}

export default App
