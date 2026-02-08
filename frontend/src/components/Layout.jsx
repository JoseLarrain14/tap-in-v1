import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const SIDEBAR_KEY = 'sidebar_collapsed';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  });

  const handleToggle = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(SIDEBAR_KEY, String(newState));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/ingresos', label: 'Ingresos', icon: '💰' },
    { to: '/solicitudes', label: 'Egresos', icon: '📋' },
    { to: '/reportes', label: 'Reportes', icon: '📈' },
    { to: '/notificaciones', label: 'Notificaciones', icon: '🔔' },
    ...(user?.role === 'presidente' ? [{ to: '/configuracion', label: 'Configuración', icon: '⚙️' }] : []),
  ];

  // Bottom nav items (subset for mobile - main navigation items)
  const bottomNavItems = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/ingresos', label: 'Ingresos', icon: '💰' },
    { to: '/solicitudes', label: 'Egresos', icon: '📋' },
    { to: '/notificaciones', label: 'Notificaciones', icon: '🔔' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - hidden on mobile, visible on md+ */}
      <aside
        data-testid="sidebar"
        data-collapsed={collapsed ? 'true' : 'false'}
        className={`hidden md:flex ${collapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex-col min-h-screen transition-all duration-200`}
      >
        {/* Logo + Toggle */}
        <div className={`${collapsed ? 'px-2' : 'px-6'} py-5 border-b border-gray-200 flex items-center justify-between`}>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold text-primary-700">Tap In</h1>
              <p className="text-xs text-gray-400 mt-0.5">{user?.organization_name}</p>
            </div>
          )}
          <button
            onClick={handleToggle}
            data-testid="sidebar-toggle"
            className={`${collapsed ? 'mx-auto' : ''} p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors`}
            title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 ${collapsed ? 'px-1.5' : 'px-3'} py-4 space-y-1`}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{item.icon}</span>
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className={`${collapsed ? 'px-1.5' : 'px-3'} py-4 border-t border-gray-200`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm">
                {user?.name?.charAt(0)}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Cerrar sesión"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm">
                  {user?.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full mt-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
              >
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Mobile header - visible on mobile only */}
      <header
        data-testid="mobile-header"
        className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between"
      >
        <h1 className="text-lg font-bold text-primary-700">Tap In</h1>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-xs">
            {user?.name?.charAt(0)}
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
            title="Cerrar sesión"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* Main content - adjusted padding for mobile header/bottom nav */}
      <main className="flex-1 p-4 pt-16 pb-20 md:p-8 md:pt-8 md:pb-8">
        <Outlet />
      </main>

      {/* Bottom navigation - visible on mobile only */}
      <nav
        data-testid="bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-center justify-around px-2 py-1"
      >
        {bottomNavItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            data-testid={`bottom-nav-${item.label.toLowerCase()}`}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-w-0 ${
                isActive
                  ? 'text-primary-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
