import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  FaTrafficLight, FaChartLine, FaMapMarkedAlt, FaRoad, FaExclamationTriangle, 
  FaSignInAlt, FaSignOutAlt, FaBars, FaTimes, FaGlobe, FaUser 
} from 'react-icons/fa';
import { Footer } from '../components/common/Footer';

export const PublicLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 w-full font-sans antialiased">
      
      {/* Top Header Navigation */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-slate-800 bg-slate-950/95 backdrop-blur-md w-full shadow-xl">
        <div className="w-full px-6">
          <div className="flex items-center justify-between h-16 gap-4">
            
            {/* Brand Logo */}
            <Link to="/public/dashboard" className="flex items-center space-x-3 group shrink-0">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-700/60 group-hover:border-teal-500/50 transition-colors">
                <FaTrafficLight className="text-teal-400 text-xl" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-100 tracking-wide flex items-center gap-1.5">
                  TrafficVision <span className="text-teal-400 font-extrabold">AI</span>
                </span>
                <span className="block text-[10px] text-slate-400 -mt-1 font-medium tracking-wider uppercase">
                  Public Transparency Portal
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-1 font-medium text-xs">
              <Link
                to="/public/dashboard"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl transition-colors ${
                  isActive('/public/dashboard')
                    ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <FaChartLine />
                <span>Traffic Dashboard</span>
              </Link>

              <Link
                to="/public/map"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl transition-colors ${
                  isActive('/public/map')
                    ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <FaMapMarkedAlt />
                <span>Traffic Map</span>
              </Link>

              <Link
                to="/public/roads"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl transition-colors ${
                  isActive('/public/roads')
                    ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <FaRoad />
                <span>Monitored Roads</span>
              </Link>

              <Link
                to="/public/alerts"
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl transition-colors ${
                  isActive('/public/alerts')
                    ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <FaExclamationTriangle className="text-amber-400" />
                <span>Active Advisories</span>
              </Link>
            </div>

            {/* Portal Action / User Profile Bar */}
            <div className="flex items-center space-x-3 shrink-0">
              <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-teal-400 font-mono">
                <FaGlobe className="text-xs animate-pulse" />
                <span>LIVE TELEMETRY STREAM</span>
              </div>

              {isAuthenticated && user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 p-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-teal-500/40 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center text-xs">
                      {user && typeof user.name === 'string' && user.name.length > 0 ? user.name.charAt(0).toUpperCase() : 'P'}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-slate-100 leading-tight">{user?.name || 'Public User'}</span>
                      <span className="text-[9px] text-teal-400 font-mono uppercase font-bold">
                        {user?.role === 'PUBLIC' ? 'Public Commuter' : (user?.role || 'User')}
                      </span>
                    </div>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 space-y-1">
                      <div className="px-3 py-2 border-b border-slate-800 mb-1">
                        <p className="text-xs font-bold text-slate-100">{user?.name || 'Public User'}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{user?.email || ''}</p>
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
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center space-x-2 bg-teal-500 hover:bg-teal-400 text-slate-950 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all shadow-md shadow-teal-500/20"
                >
                  <FaSignInAlt />
                  <span>Portal Login</span>
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100"
              >
                {mobileMenuOpen ? <FaTimes className="text-lg" /> : <FaBars className="text-lg" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950 p-4 space-y-2 text-xs">
            <Link
              to="/public/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-900"
            >
              <FaChartLine className="text-teal-400" />
              <span>Traffic Dashboard</span>
            </Link>
            <Link
              to="/public/map"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-900"
            >
              <FaMapMarkedAlt className="text-teal-400" />
              <span>Traffic Map</span>
            </Link>
            <Link
              to="/public/roads"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-900"
            >
              <FaRoad className="text-teal-400" />
              <span>Monitored Roads</span>
            </Link>
            <Link
              to="/public/alerts"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-900"
            >
              <FaExclamationTriangle className="text-amber-400" />
              <span>Active Advisories</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Page Body Container */}
      <main className="flex-1 px-6 py-6 w-full max-w-7xl mx-auto min-w-0">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};
