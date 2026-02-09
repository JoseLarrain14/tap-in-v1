import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Ingresos from './pages/Ingresos';
import Solicitudes from './pages/Solicitudes';
import Reportes from './pages/Reportes';
import Notificaciones from './pages/Notificaciones';
import Configuracion from './pages/Configuracion';
import SolicitudDetail from './pages/SolicitudDetail';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RoleRoute({ children, roles }) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ProtectedNotFound() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <NotFound />;
}

function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="ingresos" element={<Ingresos />} />
            <Route path="solicitudes" element={<Solicitudes />} />
            <Route path="solicitudes/:id" element={<SolicitudDetail />} />
            <Route path="egresos" element={<Navigate to="/solicitudes" replace />} />
            <Route path="egresos/:id" element={<SolicitudDetail />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="notificaciones" element={<Notificaciones />} />
            <Route path="configuracion/*" element={
              <RoleRoute roles={['presidente']}>
                <Configuracion />
              </RoleRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="*" element={<ProtectedNotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
