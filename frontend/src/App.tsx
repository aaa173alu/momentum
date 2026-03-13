import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar.tsx'
import CapsuleView from './pages/CapsuleView.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Home from './pages/Home.tsx'
import Login from './pages/Login.tsx'
import Register from './pages/Register.tsx'
import UploadCapsule from './pages/UploadCapsule.tsx'
import './styles/app.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/capsula" element={<CapsuleView />} />
            <Route path="/subir" element={<UploadCapsule />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
