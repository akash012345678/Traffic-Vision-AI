import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  FaChartPie, 
  FaRoad, 
  FaVideo, 
  FaUserTie, 
  FaExclamationTriangle, 
  FaCogs, 
  FaUser, 
  FaSignOutAlt,
  FaLayerGroup,
  FaExchangeAlt,
  FaChartBar,
  FaFire
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

export const Sidebar = ({ role = 'Operator' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminMenuItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: FaChartPie },
    { label: 'Traffic Heatmap', path: '/admin/heatmap', icon: FaFire },
    { label: 'Road Management', path: '/admin/roads', icon: FaRoad },
    { label: 'Zone Management', path: '/admin/zones', icon: FaLayerGroup },
    { label: 'Operator Management', path: '/admin/operators', icon: FaUserTie },
    { label: 'Assignment Management', path: '/admin/assignments', icon: FaExchangeAlt },
    { label: 'Traffic Monitoring', path: '/admin/monitoring', icon: FaVideo },
    { label: 'Alerts', path: '/admin/alerts', icon: FaExclamationTriangle },
    { label: 'Reports', path: '/admin/reports', icon: FaChartBar },
    { label: 'Settings', path: '/admin/settings', icon: FaCogs },
  ];

  const operatorMenuItems = [
    { label: 'Dashboard', path: '/operator/dashboard', icon: FaChartPie },
    { label: 'Traffic Heatmap', path: '/operator/heatmap', icon: FaFire },
    { label: 'Assigned Roads', path: '/operator/roads', icon: FaRoad },
    { label: 'Traffic Monitoring', path: '/operator/monitoring', icon: FaVideo },
    { label: 'Alerts', path: '/operator/alerts', icon: FaExclamationTriangle },
    { label: 'Profile', path: '/operator/profile', icon: FaUser },
  ];

  const isAdmin = (role || '').toUpperCase() === 'ADMIN';
  const menuItems = isAdmin ? adminMenuItems : operatorMenuItems;

  return (
    <aside className="w-64 glass-panel border-r border-slate-800 p-4 flex flex-col justify-between hidden lg:flex sticky top-16 h-[calc(100vh-4rem)] self-start shrink-0">

      <div className="space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">
            {role} Console
          </p>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Icon className={active ? 'text-teal-400' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <FaSignOutAlt />
          <span>Exit Session</span>
        </button>
      </div>
    </aside>
  );
};
