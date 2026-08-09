import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  FaTrafficLight, 
  FaUserShield, 
  FaTv, 
  FaSignInAlt, 
  FaSignOutAlt, 
  FaSearch, 
  FaBell, 
  FaUser, 
  FaBars, 
  FaTimes, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaGlobe,
  FaUserPlus
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge } from './StatusBadge';
import apiClient from '../../services/api';

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Live Supabase Alerts state for Notifications Bell
  const [liveAlerts, setLiveAlerts] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchLiveAlerts = async () => {
      try {
        const res = await apiClient.get('/alerts', { params: { status: 'ACTIVE', page_size: 5 } });
        const list = Array.isArray(res) ? res : (res.items || []);
        setLiveAlerts(list);
      } catch (err) {
        // Silent catch for background notification poll
      }
    };

    fetchLiveAlerts();
    const timer = setInterval(fetchLiveAlerts, 10000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const roleUpper = (user?.role || '').toUpperCase();
      if (roleUpper === 'ADMIN') {
        navigate('/admin/roads');
      } else {
        navigate('/operator/dashboard');
      }
    }
  };

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-slate-800 bg-slate-950/95 backdrop-blur-md w-full shadow-xl">
      <div className="w-full px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center space-x-3 group shrink-0">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-700/60 group-hover:border-teal-500/50 transition-colors">
              <FaTrafficLight className="text-teal-400 text-xl" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-100 tracking-wide flex items-center gap-1.5">
                TrafficVision <span className="text-teal-400 font-extrabold">AI</span>
              </span>
              <span className="block text-[10px] text-slate-400 -mt-1 font-medium tracking-wider">
                CONGESTION MANAGEMENT SYSTEM
              </span>
            </div>
          </Link>

          {/* Search Bar (Shown when authenticated) */}
          {isAuthenticated && (
            <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-xl items-center relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                <FaSearch />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search road corridors, junctions, operators..."
                className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-teal-500 transition-colors"
              />
            </form>
          )}

          {/* Action / User Bar */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="hidden sm:block">
              <StatusBadge status="System Online" type="green" />
            </div>

            {isAuthenticated ? (
              <div className="flex items-center space-x-3 relative">
                
                {/* Notifications Bell */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      setShowProfileMenu(false);
                    }}
                    className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-teal-400 relative transition-colors"
                    title="Live Supabase Active Incident Alerts"
                  >
                    <FaBell className="text-sm" />
                    {liveAlerts.length > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-3 space-y-2 font-sans">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-100">Live Active Alerts</span>
                        <span className="text-[10px] text-amber-400 font-mono">{liveAlerts.length} Active</span>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {liveAlerts.length === 0 ? (
                          <div className="p-3 text-center text-slate-500 text-xs italic">
                            No active incident alerts registered in Supabase.
                          </div>
                        ) : (
                          liveAlerts.map((a) => (
                            <div 
                              key={a.id} 
                              onClick={() => {
                                setShowNotifications(false);
                                if (user?.role === 'Admin') navigate('/admin/alerts');
                                else navigate('/operator/alerts');
                              }}
                              className="p-2.5 bg-slate-950/80 hover:bg-slate-900 rounded-lg border border-slate-800 text-xs cursor-pointer transition-colors"
                            >
                              <div className="flex justify-between items-center mb-0.5 font-mono">
                                <span className="font-bold text-amber-300">
                                  #{a.id.toString().padStart(3, '0')} • {a.alert_type}
                                </span>
                                <span className="text-[9px] text-rose-400 uppercase font-semibold">{a.severity}</span>
                              </div>
                              <p className="text-[11px] text-slate-300 font-sans">{a.road?.road_name || 'City Corridor'} ({a.road?.zone || 'Zone Alpha'})</p>
                              <span className="text-[9px] text-slate-500 block font-mono mt-0.5">
                                {a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Avatar Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowProfileMenu(!showProfileMenu);
                      setShowNotifications(false);
                    }}
                    className="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-teal-500/40 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center text-xs">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="hidden lg:flex flex-col text-left">
                      <span className="text-xs font-semibold text-slate-200 leading-tight">{user?.name}</span>
                      <span className="text-[9px] text-teal-400 font-mono uppercase">{user?.role}</span>
                    </div>
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 space-y-1">
                      <div className="px-3 py-2 border-b border-slate-800 mb-1">
                        <p className="text-xs font-bold text-slate-100">{user?.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{user?.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <FaSignOutAlt />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/public/dashboard"
                  className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-teal-500/40 text-teal-400 text-xs font-semibold transition-colors"
                >
                  <FaGlobe className="text-xs" />
                  <span>Public Portal</span>
                </Link>

                <Link
                  to="/signup"
                  className="hidden sm:inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-semibold transition-colors"
                >
                  <FaUserPlus className="text-xs" />
                  <span>Sign Up</span>
                </Link>

                <Link
                  to="/login"
                  className="inline-flex items-center space-x-2 bg-teal-500 hover:bg-teal-400 text-slate-950 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all shadow-md shadow-teal-500/20"
                >
                  <FaSignInAlt />
                  <span>Portal Login</span>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100"
            >
              {mobileMenuOpen ? <FaTimes className="text-lg" /> : <FaBars className="text-lg" />}
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
};
