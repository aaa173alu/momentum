import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TemaProvider } from './context/TemaContext'
import { PreferencesProvider } from './context/PreferencesContext'
import './styles/themes.css'
import './styles/global.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider>
      <TemaProvider>
        <App />
      </TemaProvider>
    </PreferencesProvider>
  </StrictMode>,
)
