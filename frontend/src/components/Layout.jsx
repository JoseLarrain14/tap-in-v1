import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { api } from '../lib/api';
import ToastContainer from './ToastContainer';

const SIDEBAR_KEY = 'sidebar_collapsed';

function ThemeToggle({ collapsed }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      data-testid="theme-toggle"
      className={`${collapsed ? 'mx-auto' : 'w-full'} flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-3'} py-2 text-sm rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700`}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      )}
      {!collapsed && <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>}
    </button>
  );
}

function MobileThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      data-testid="theme-toggle-mobile"
      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors"
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      )}
    </button>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  });
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.get('/notifications/unread-count');
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      // Silently fail - notification badge is not critical
      console.debug('Failed to fetch unread count:', err.message);
    }
  }, []);

  useEffect(() => {
    // Fetch initial unread count
    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    // Listen for custom events from Notificaciones page
    const handleUpdate = () => fetchUnreadCount();
    window.addEventListener('notifications-updated', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-updated', handleUpdate);
    };
  }, [fetchUnreadCount]);

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
    { to: '/notificaciones', label: 'Notificaciones', icon: '🔔', badge: unreadCount },
    ...(user?.role === 'presidente' ? [{ to: '/configuracion', label: 'Configuración', icon: '⚙️' }] : []),
  ];

  // Bottom nav items (subset for mobile - main navigation items)
  const bottomNavItems = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/ingresos', label: 'Ingresos', icon: '💰' },
    { to: '/solicitudes', label: 'Egresos', icon: '📋' },
    { to: '/notificaciones', label: 'Notificaciones', icon: '🔔', badge: unreadCount },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-200 overflow-x-hidden max-w-full">
      {/* Global Toast Container */}
      <ToastContainer />

      {/* Sidebar - hidden on mobile, visible on md+ */}
      <aside
        data-testid="sidebar"
        data-collapsed={collapsed ? 'true' : 'false'}
        className={`hidden md:flex ${collapsed ? 'w-16' : 'w-64'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col min-h-screen transition-all duration-200`}
      >
        {/* Logo + Toggle */}
        <div className={`${collapsed ? 'px-2' : 'px-6'} py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between`}>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold text-primary-700 dark:text-primary-400">Tap In</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{user?.organization_name}</p>
            </div>
          )}
          <button
            onClick={handleToggle}
            data-testid="sidebar-toggle"
            className={`${collapsed ? 'mx-auto' : ''} p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
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
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              <span className="relative">
                {item.icon}
                {item.badge > 0 && (
                  <span
                    className="absolute -top-2 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1"
                    data-testid="notification-badge"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between">
                  {item.label}
                  {item.badge > 0 && (
                    <span
                      className="ml-2 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1.5"
                      data-testid="notification-badge-label"
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Theme toggle + User section */}
        <div className={`${collapsed ? 'px-1.5' : 'px-3'} py-2 border-t border-gray-200 dark:border-gray-700`}>
          <ThemeToggle collapsed={collapsed} />
        </div>
        <div className={`${collapsed ? 'px-1.5' : 'px-3'} py-4 border-t border-gray-200 dark:border-gray-700`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-primary-700 dark:text-primary-400 font-semibold text-sm">
                {user?.name?.charAt(0)}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-sm text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-primary-700 dark:text-primary-400 font-semibold text-sm">
                  {user?.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full mt-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
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
        className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between transition-colors duration-200"
      >
        <h1 className="text-lg font-bold text-primary-700 dark:text-primary-400">Tap In</h1>
        <div className="flex items-center gap-3">
          <MobileThemeToggle />
          <div className="w-7 h-7 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-primary-700 dark:text-primary-400 font-semibold text-xs">
            {user?.name?.charAt(0)}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
            title="Cerrar sesión"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* Main content - adjusted padding for mobile header/bottom nav */}
      <main className="flex-1 min-w-0 p-4 pt-16 pb-20 md:p-8 md:pt-8 md:pb-8 transition-colors duration-200 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Bottom navigation - visible on mobile only */}
      <nav
        data-testid="bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-around px-2 py-1 transition-colors duration-200"
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
                  ? 'text-primary-700 dark:text-primary-400'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`
            }
          >
            <span className="relative text-lg">
              {item.icon}
              {item.badge > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5"
                  data-testid="notification-badge-mobile"
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
