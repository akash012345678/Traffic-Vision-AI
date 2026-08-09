import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaBell, FaCheckDouble, FaExclamationTriangle, FaExternalLinkAlt, FaTimes } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';

export const NotificationBell = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiClient.get('/notifications?limit=15');
      setNotifications(res?.notifications || []);
      setUnreadCount(res?.unread_count || 0);
    } catch (err) {
      console.error("Notification fetch error:", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Mark all read error:", err);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
    setIsOpen(false);

    const userRole = (user?.role || '').toUpperCase();

    if (notif.road_id) {
      if (userRole === 'ADMIN' || userRole === 'OPERATOR') {
        navigate(`/roads/${notif.road_id}`);
      } else {
        navigate(`/public/map?road_id=${notif.road_id}`);
      }
    } else if (userRole === 'ADMIN') {
      navigate('/admin/alerts');
    } else if (userRole === 'OPERATOR') {
      navigate('/operator/alerts');
    } else {
      navigate('/public/alerts');
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors focus:outline-none"
        title="Notifications"
      >
        <FaBell className="text-base text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full ring-2 ring-slate-950 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl z-50 overflow-hidden animate-fade-in">
          
          {/* Header */}
          <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FaBell className="text-amber-400 text-xs" />
              <span className="text-xs font-bold text-slate-100 font-mono uppercase">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} Unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] text-teal-400 hover:text-teal-300 font-mono font-bold flex items-center gap-1 transition-colors"
              >
                <FaCheckDouble />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                No new notifications
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 text-xs transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                    notif.is_read
                      ? 'bg-slate-950/40 hover:bg-slate-900/40 opacity-75'
                      : 'bg-slate-900/80 hover:bg-slate-900 border-l-2 border-l-amber-500'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        notif.severity === 'CRITICAL' ? 'bg-rose-500 animate-pulse' :
                        notif.severity === 'HIGH' ? 'bg-orange-500' :
                        notif.severity === 'MODERATE' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <strong className="text-slate-100 font-bold truncate block">{notif.title}</strong>
                    </div>

                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">{notif.message}</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                      <span>{notif.road_name || 'System Corridor'}</span>
                      <span>
                        {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>

                  {!notif.is_read && (
                    <button
                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                      className="text-slate-500 hover:text-teal-400 p-1 shrink-0 transition-colors"
                      title="Mark as read"
                    >
                      <FaTimes className="text-xs" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 font-mono">
              AI Telemetry Event Stream • Real-Time Scoped Notifications
            </span>
          </div>

        </div>
      )}
    </div>
  );
};
