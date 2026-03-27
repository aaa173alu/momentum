import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.tsx'
import CapsuleView from './pages/CapsuleView.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Home from './pages/Home.tsx'
import InitialLoading from './pages/InitialLoading.tsx'
import Login from './pages/Login.tsx'
import Register from './pages/Register.tsx'
import UploadCapsule from './pages/UploadCapsule.tsx'
import './styles/app.css'

function AppLayout() {
  const location = useLocation()
  const hideNavbar = location.pathname === '/login' || location.pathname === '/registro'

  return (
    <div className="app-shell">
      {!hideNavbar && <Navbar />}
      <main className={`app-content ${hideNavbar ? 'app-content--auth' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/carga-inicial" element={<InitialLoading />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/capsula" element={<CapsuleView />} />
          <Route path="/subir" element={<UploadCapsule />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
