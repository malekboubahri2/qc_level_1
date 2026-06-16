import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Keep --actual-vh in sync with the visual viewport (excludes on-screen keyboard).
// This is more reliable than dvh alone on Android WebView and older iOS.
;(function setupViewportHeight() {
  const update = () => {
    const h = window.visualViewport?.height ?? window.innerHeight
    document.documentElement.style.setProperty('--actual-vh', `${h}px`)
  }
  update()
  window.visualViewport?.addEventListener('resize', update)
  window.addEventListener('resize', update)
})()
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './lib/auth'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
