import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AirstripsMap from './pages/AirstripsMap'
import WorldMap from './pages/WorldMap'
import Regions from './pages/Regions'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import Login from './pages/Login'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="map" element={<AirstripsMap />} />
          <Route path="world-map" element={<WorldMap />} />
          <Route path="regions" element={<Regions />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
