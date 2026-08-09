import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaExclamationTriangle, FaSearch, FaFilter, FaTimes, FaRoad, FaClock, FaCheckCircle 
} from 'react-icons/fa';
import { PublicLayout } from '../layouts/PublicLayout';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { SkeletonTable } from '../components/ui/Skeleton';
import apiClient from '../services/api';

export const PublicAlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get('/public/alerts');
        const list = Array.isArray(res) ? res : [];
        setAlerts(list);
      } catch (err) {
        setError('Failed to load active public traffic alerts.');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || a.alert_type.toLowerCase().includes(q) || a.road_name.toLowerCase().includes(q) || a.zone.toLowerCase().includes(q) || a.alert_code.toLowerCase().includes(q);
      const matchesSev = severityFilter === 'ALL' || (a.severity || '').toUpperCase() === severityFilter.toUpperCase();
      return matchesSearch && matchesSev;
    });
  }, [alerts, searchQuery, severityFilter]);

  const getSeverityBadge = (sev) => {
    const s = (sev || 'MEDIUM').toUpperCase();
    if (s === 'CRITICAL' || s === 'HIGH') return 'red';
    if (s === 'MEDIUM' || s === 'MODERATE') return 'amber';
    return 'green';
  };

  return (
    <PublicLayout>
      <div className="space-y-6 animate-fade-in w-full">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
              <FaExclamationTriangle className="text-amber-400 text-xl" />
              <span>Active Traffic Advisories & Incidents</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Public safety warnings, AI congestion alerts, and active corridor advisories across the metropolitan transit network.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
              <input
                type="text"
                placeholder="Search alert code, type, road, or zone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <FaTimes />
                </button>
              )}
            </div>

            {/* Severity Filter */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-medium">Severity Level:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="ALL">All Severities</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

          </div>
        </Card>

        {/* Alerts Grid / Table */}
        <Card title="Public Incident Advisories" subtitle={`Displaying ${filteredAlerts.length} active public warnings`}>
          {loading ? (
            <SkeletonTable rows={5} />
          ) : error ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <FaExclamationTriangle className="text-3xl text-rose-500 mx-auto" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <FaCheckCircle className="text-3xl text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-200">No active public traffic advisories currently reported.</p>
              <p className="text-xs text-slate-400">All city corridors are operating normally.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
              {filteredAlerts.map((a) => (
                <div key={a.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-amber-400">{a.alert_code}</span>
                      <span className="text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                        {a.alert_type}
                      </span>
                    </div>
                    <StatusBadge status={a.severity} type={getSeverityBadge(a.severity)} />
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <FaRoad className="text-teal-400 text-xs shrink-0" />
                    <strong className="text-slate-100">{a.road_name}</strong>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">{a.zone}</span>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed font-sans">
                    {a.notes}
                  </p>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1">
                    <span className="flex items-center gap-1">
                      <FaClock /> Reported: {new Date(a.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    <span className="text-amber-400/80 font-bold uppercase">● ACTIVE ADVISORY</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </PublicLayout>
  );
};
