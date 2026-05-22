import { Outlet } from 'react-router-dom'
import AppBottomNav from './AppBottomNav.tsx'

function PrivateLayout() {
  return (
    <div className="private-shell">
      <main className="app-content app-content--private">
        <Outlet />
      </main>
      <AppBottomNav />
    </div>
  )
}

export default PrivateLayout
