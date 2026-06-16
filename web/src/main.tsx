import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './lib/auth'
import { App } from './App'
import './index.css'

// Track keyboard height so the inspector footer can float just above it.
// Only the footer lifts — nothing squishes.
;(function setupKeyboardInset() {
  const update = () => {
    const kh = Math.max(0, window.innerHeight - (window.visualViewport?.height ?? window.innerHeight))
    document.documentElement.style.setProperty('--keyboard-inset', `${kh}px`)
  }
  update()
  window.visualViewport?.addEventListener('resize', update)
}())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
