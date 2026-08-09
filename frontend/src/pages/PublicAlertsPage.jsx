import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaExclamationTriangle, FaSearch, FaFilter, FaTimes, FaRoad, FaClock, 
  FaCheckCircle, FaSync, FaMapMarkedAlt, FaArrowRight, FaShieldAlt, FaInfoCircle 
} from 'react-icons/fa';
import { PublicLayout } from '../layouts/PublicLayout';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { SkeletonTable } from '../components/ui/Skeleton';
import apiClient from '../services/api';

export const PublicAlertsPage = () => {
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [zoneFilter, setZoneFilter] = useState('ALL');

  const fetchPublicAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/public/alerts');
      const list = Array.isArray(res) ? res : [];
      setAlerts(list);
    } catch (err) {
      console.error('Public alerts fetch error:', err);
      setError('Failed to fetch active public traffic advisories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicAlerts();
    const interval = setInterval(fetchPublicAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  const zones = useMemo(() => {
    const setZ = new Set(alerts.map(a => a.zone).filter(Boolean));
    return Array.from(setZ);
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q || 
        (a.alert_type && a.alert_type.toLowerCase().includes(q)) || 
        (a.road_name && a.road_name.toLowerCase().includes(q)) || 
        (a.zone && a.zone.toLowerCase().includes(q)) || 
        (a.alert_code && a.alert_code.toLowerCase().includes(q));

      const matchesSev = severityFilter === 'ALL' || (a.severity || '').toUpperCase() === severityFilter.toUpperCase();
      const matchesZone = zoneFilter === 'ALL' || a.zone === zoneFilter;

      return matchesSearch && matchesSev && matchesZone;
    });
  }, [alerts, searchQuery, severityFilter, zoneFilter]);

  const getSeverityBadgeType = (sev) => {
    const s = (sev || 'MEDIUM').toUpperCase();
    if (s === 'CRITICAL' || s === 'HIGH') return 'red';
    if (s === 'MEDIUM' || s === 'MODERATE') return 'amber';
    return 'green';
  };

  const formatTimeSafely = (dateStr) => {
    if (!dateStr) return 'Live';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Live';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Live';
    }
  };

  const handleClearAlertFilters = () => {
    setSearchQuery('');
    setSeverityFilter('ALL');
    setZoneFilter('ALL');
  };

  const hasActiveFilters = searchQuery !== '' || severityFilter !== 'ALL' || zoneFilter !== 'ALL';

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
              Public safety warnings, AI congestion alerts, and active corridor advisories powered by real-time telemetry.
            </p>
          </div>

          <button
            onClick={fetchPublicAlerts}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-2 transition-colors shrink-0"
          >
            <FaSync className={loading ? 'animate-spin text-amber-400' : 'text-slate-400'} />
            <span>Refresh Advisories</span>
          </button>
        </div>

        {/* Toolbar: Search & Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
              <input
                type="text"
                placeholder="Search alert reference, road, or zone..."
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

            {/* Filters & Clear Action */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto text-xs">
              
              {/* Severity Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-medium">Severity:</span>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ALL">All Severities</option>
                  <option value="LOW">LOW</option>
                  <option value="MODERATE">MODERATE</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL / SEVERE</option>
                </select>
              </div>

              {/* Zone Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-medium">Zone:</span>
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ALL">All Zones</option>
                  {zones.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button
                  onClick={handleClearAlertFilters}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                >
                  <FaTimes className="text-xs" />
                  <span>Clear Filters</span>
                </button>
              )}

            </div>

          </div>
        </Card>

        {/* Main Grid: Active Advisories + Read-Only Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Advisories Roster */}
          <div className="lg:col-span-7 space-y-4">
            <Card title="Active Network Advisories" subtitle={`Displaying ${filteredAlerts.length} verified public warnings`}>
              {loading ? (
                <SkeletonTable rows={4} />
              ) : error ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <FaExclamationTriangle className="text-3xl text-rose-500 mx-auto" />
                  <p className="text-sm font-semibold">{error}</p>
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2 bg-slate-950/40 rounded-xl border border-slate-800/80 m-2">
                  <FaCheckCircle className="text-4xl text-emerald-400 mx-auto" />
                  <h3 className="text-base font-bold text-slate-200">No Active Traffic Advisories</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Traffic flow is currently normal and free-flowing across all monitored metropolitan corridors.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 p-2">
                  {filteredAlerts.map((a) => {
                    const isSelected = selectedAlert?.id === a.id;
                    return (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAlert(a)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-500/10'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-amber-400">{a.alert_code}</span>
                            <span className="text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                              {a.alert_type}
                            </span>
                          </div>
                          <StatusBadge status={a.severity} type={getSeverityBadgeType(a.severity)} />
                        </div>

                        <div className="flex items-center space-x-2 text-xs text-slate-300 mb-2">
                          <FaRoad className="text-teal-400 text-xs shrink-0" />
                          <strong className="text-slate-100">{a.road_name}</strong>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{a.zone}</span>
                        </div>

                        <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed font-sans line-clamp-2">
                          {a.notes}
                        </p>

                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-2">
                          <span className="flex items-center gap-1">
                            <FaClock /> Reported: {formatTimeSafely(a.created_at)}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/public/map?road_id=${a.road_id}`);
                            }}
                            className="text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 transition-colors"
                          >
                            <span>View Live Map</span>
                            <FaArrowRight className="text-[9px]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Read-Only Alert Inspector Panel */}
          <div className="lg:col-span-5">
            {selectedAlert ? (
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 sticky top-24 shadow-2xl">
                
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-amber-400">{selectedAlert.alert_code}</span>
                    <h3 className="text-lg font-bold text-slate-100 mt-0.5">{selectedAlert.alert_type}</h3>
                    <p className="text-xs text-slate-400">{selectedAlert.road_name}</p>
                  </div>
                  <StatusBadge status={selectedAlert.severity} type={getSeverityBadgeType(selectedAlert.severity)} />
                </div>

                <div className="space-y-3 text-xs">
                  
                  {/* Advisory Notes */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Public Advisory Summary
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {selectedAlert.notes}
                    </p>
                  </div>

                  {/* Corridor Location Specs */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5 font-mono text-[11px] text-slate-400">
                    <div className="flex justify-between">
                      <span>Corridor Zone:</span>
                      <strong className="text-slate-200">{selectedAlert.zone}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Advisory Status:</span>
                      <strong className="text-amber-400 uppercase">{selectedAlert.status}</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-800">
                      <span>Reported Time:</span>
                      <strong className="text-teal-400">{formatTimeSafely(selectedAlert.created_at)}</strong>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => navigate(`/public/map?road_id=${selectedAlert.road_id}`)}
                    className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-teal-500/20"
                  >
                    <FaMapMarkedAlt />
                    <span>Locate Corridor on Live GIS Map</span>
                  </button>

                </div>

              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs italic glass-panel rounded-2xl border border-slate-800">
                Select an active advisory from the roster to inspect details and view map location.
              </div>
            )}
          </div>

        </div>

      </div>
    </PublicLayout>
  );
};
