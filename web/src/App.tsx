import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RoleHome } from './routes/RoleHome'
import { LoginPage } from './pages/LoginPage'
import { InspecteurPage } from './pages/InspecteurPage'
import { InspecteurHistoriquePage } from './pages/InspecteurHistoriquePage'
import { MethodeEcranPage } from './pages/MethodeEcranPage'
import { MethodeMobilePage } from './pages/MethodeMobilePage'
import { MethodeHistoriquePage } from './pages/MethodeHistoriquePage'
import { AdminPage } from './pages/AdminPage'
import { KpisPage } from './pages/KpisPage'
import { VisaPage } from './pages/VisaPage'
import { AndonPage } from './pages/AndonPage'
import { NotFoundPage } from './pages/NotFoundPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RoleHome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inspecteur"
          element={
            <ProtectedRoute roles={['inspecteur']}>
              <InspecteurPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspecteur/historique"
          element={
            <ProtectedRoute roles={['inspecteur']}>
              <InspecteurHistoriquePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/methode/ecran"
          element={
            <ProtectedRoute roles={['methode']}>
              <MethodeEcranPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/methode/mobile"
          element={
            <ProtectedRoute roles={['methode']}>
              <MethodeMobilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/methode/historique"
          element={
            <ProtectedRoute roles={['methode']}>
              <MethodeHistoriquePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kpis"
          element={
            <ProtectedRoute>
              <KpisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/visa"
          element={
            <ProtectedRoute roles={['qualite', 'prod']}>
              <VisaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/andon"
          element={
            <ProtectedRoute roles={['methode']}>
              <AndonPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
