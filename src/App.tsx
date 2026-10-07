/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ModuleProvider } from './contexts/ModuleContext';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ListaBlanca from './pages/ListaBlanca';
import Servicios from './pages/Servicios';
import Empresa from './pages/Empresa';
import Configuracion from './pages/Configuracion';
import Calendario from './pages/Calendario';
import GestionCitas from './pages/GestionCitas';
import BookingPage from './pages/BookingPage';
import Clientes from './pages/Clientes';
import PlantillasWhatsapp from './pages/PlantillasWhatsapp';
import Informes from './pages/Informes';
import SuperAdmin from './pages/SuperAdmin';
import { ToastProvider } from './contexts/ToastContext';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ModuleProvider>
          <ToastProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/reservar" element={<BookingPage />} />
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/gestion-citas" element={<GestionCitas />} />
                  <Route path="/calendario" element={<Calendario />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/informes" element={<Informes />} />
                  <Route path="/mensajes-whatsapp" element={<PlantillasWhatsapp />} />
                  <Route path="/lista-blanca" element={<Navigate to="/clientes" replace />} />
                  <Route path="/servicios" element={<Servicios />} />
                  <Route path="/empresa" element={<Empresa />} />
                  <Route path="/config" element={<Configuracion />} />
                  <Route path="/superadmin" element={<SuperAdmin />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </ToastProvider>
        </ModuleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

