import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FaRoad, FaExclamationTriangle, FaCheckCircle, FaClock, 
  FaSync, FaArrowRight, FaShieldAlt, FaTachometerAlt, FaCar, FaMapMarkerAlt,
  FaStar, FaRegStar, FaUserCheck, FaRoute, FaLocationArrow, FaCarSide 
} from 'react-icons/fa';
import { PublicLayout } from '../layouts/PublicLayout';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';

export const PublicDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState(null);
  const [roads, setRoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Favorites & Personalization state (starts empty until user pins corridors)
  const userId = user?.id || 'guest';
  const storageKey = `tv_favorites_${userId}`;
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Daily Commute Estimator state (starts empty until user selects corridors)
  const [homeRoadId, setHomeRoadId] = useState('');
  const [workRoadId, setWorkRoadId] = useState('');

  const fetchPublicData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, roadsRes] = await Promise.all([
        apiClient.get('/public/dashboard-stats'),
        apiClient.get('/public/roads')
      ]);
      setStats(statsRes || {});
      const list = Array.isArray(roadsRes) ? roadsRes : [];
      setRoads(list);
    } catch (err) {
      console.error("Public dashboard telemetry fetch error:", err);
      setError('Failed to fetch real-time public traffic telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicData();
    const interval = setInterval(fetchPublicData, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleFavorite = (roadId) => {
    setFavorites((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const next = prevArr.includes(roadId) ? prevArr.filter((id) => id !== roadId) : [...prevArr, roadId];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const getCongestionType = (level) => {
    const lvl = (level || 'LOW').toString().toUpperCase();
    if (lvl === 'LOW') return 'green';
    if (lvl === 'MODERATE') return 'amber';
    if (lvl === 'HIGH') return 'amber';
    return 'red';
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

  // Pinned Favorite Roads
  const pinnedRoads = useMemo(() => {
    const favArr = Array.isArray(favorites) ? favorites : [];
    if (!Array.isArray(roads)) return [];
    return roads.filter((r) => r && r.id && favArr.includes(r.id));
  }, [roads, favorites]);

  // Commute Estimation Calculation
  const homeRoad = useMemo(() => {
    if (!Array.isArray(roads) || !homeRoadId) return null;
    return roads.find((r) => r && r.id && r.id.toString() === homeRoadId.toString());
  }, [roads, homeRoadId]);

  const workRoad = useMemo(() => {
    if (!Array.isArray(roads) || !workRoadId) return null;
    return roads.find((r) => r && r.id && r.id.toString() === workRoadId.toString());
  }, [roads, workRoadId]);

  const commuteCalc = useMemo(() => {
    if (!homeRoad || !workRoad) return null;
    const len1 = Number(homeRoad.length_km) || 2.5;
    const len2 = Number(workRoad.length_km) || 2.5;
    const distKm = (len1 + len2).toFixed(1);

    const spd1 = Number(homeRoad.average_speed) || 60;
    const spd2 = Number(workRoad.average_speed) || 60;
    const avgSpd = Math.round((spd1 + spd2) / 2);

    const totalVeh = (Number(homeRoad.vehicle_count) || 0) + (Number(workRoad.vehicle_count) || 0);
    const estMinutes = Math.max(3, Math.round((parseFloat(distKm) / (avgSpd || 40)) * 60));
    const hasDelay = (homeRoad.congestion_level || '').toString().toUpperCase() !== 'LOW' || (workRoad.congestion_level || '').toString().toUpperCase() !== 'LOW';

    return { distKm, avgSpd, totalVeh, estMinutes, hasDelay };
  }, [homeRoad, workRoad]);

  return (
    <PublicLayout>
      <div className="space-y-6 animate-fade-in w-full">
        
        {/* Personalized Welcome Banner for Authenticated Public Commuter */}
        {isAuthenticated && user ? (
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/60 p-6 rounded-2xl border border-teal-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <FaUserCheck className="text-teal-400" />
                    <span>Logged In • Public Commuter</span>
                  </span>
                  <span className="text-xs font-mono text-slate-400">ID #{user.id || '1'}</span>
                </div>

                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">
                  Welcome back, <span className="text-teal-400">{user.name || 'Commuter'}</span>!
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Your personal traffic intelligence dashboard. Monitor your pinned corridors, estimate daily commute delays, and track live city alerts.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={fetchPublicData}
                  disabled={loading}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-2 transition-colors"
                >
                  <FaSync className={loading ? 'animate-spin text-teal-400' : 'text-slate-400'} />
                  <span>Refresh Telemetry</span>
                </button>

                <Link
                  to="/public/map"
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center space-x-2 transition-all shadow-md shadow-teal-500/20"
                >
                  <FaMapMarkerAlt />
                  <span>Live Traffic Map</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Guest Portal Banner */
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40 p-6 rounded-2xl border border-slate-800 shadow-xl">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full inline-block mb-2">
                City Traffic Intelligence • Public Portal
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">
                Metropolitan Traffic Dashboard
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Real-time public traffic monitoring powered by computer vision detection across urban corridors, junctions, and expressways.
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={fetchPublicData}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-2 transition-colors"
              >
                <FaSync className={loading ? 'animate-spin text-teal-400' : 'text-slate-400'} />
                <span>Refresh Telemetry</span>
              </button>

              <Link
                to="/public/map"
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center space-x-2 transition-all shadow-md shadow-teal-500/20"
              >
                <FaMapMarkerAlt />
                <span>Live Traffic Map</span>
              </Link>
            </div>
          </div>
        )}

        {/* Personalized Pinned Corridors Section (For Logged-In & Public Users) */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FaStar className="text-amber-400 text-sm" />
              <span>My Pinned Commute Corridors</span>
              <span className="text-xs font-mono text-slate-400 font-normal">({pinnedRoads.length} Pinned)</span>
            </h2>
            <span className="text-[11px] text-slate-400">Click ⭐ to pin/unpin any corridor</span>
          </div>

          {pinnedRoads.length === 0 ? (
            <div className="p-6 text-center text-slate-400 glass-panel rounded-xl border border-slate-800 text-xs">
              No corridors pinned yet. Click the ⭐ icon next to any road in the roster below to save it to your personal dashboard!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {pinnedRoads.map((r) => (
                <div key={r.id} className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-slate-900/90 relative group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono font-bold text-teal-400">{r.road_code}</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleFavorite(r.id)}
                        className="text-amber-400 hover:scale-110 transition-transform p-1"
                        title="Unpin corridor"
                      >
                        <FaStar />
                      </button>
                      <StatusBadge status={r.congestion_level} type={getCongestionType(r.congestion_level)} />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 mb-1">{r.road_name}</h3>
                  <p className="text-[11px] text-slate-400 mb-3">{r.zone}</p>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Vehicles</span>
                      <span className="font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                        <FaCar className="text-slate-500 text-[10px]" /> {r.vehicle_count || 0} veh
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Avg Speed</span>
                      <span className="font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                        <FaTachometerAlt className="text-emerald-500/70 text-[10px]" /> {r.average_speed || 0} km/h
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Personalized Daily Commute Estimator Widget */}
        <Card className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FaRoute className="text-teal-400" />
                <span>Daily Commute Route Estimator</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Select your origin & destination corridors to calculate live combined travel delay and estimated transit time.
              </p>
            </div>

            {commuteCalc && (
              <div className="flex items-center space-x-4 text-xs font-mono">
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">ESTIMATED TRAVEL TIME</span>
                  <span className="text-lg font-black text-teal-400">{commuteCalc.estMinutes} mins</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">COMBINED DISTANCE</span>
                  <span className="text-lg font-black text-slate-200">{commuteCalc.distKm} km</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            
            {/* Origin Corridor */}
            <div>
              <label className="block font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <FaLocationArrow className="text-emerald-400 text-xs" /> Home / Origin Corridor
              </label>
              <select
                value={homeRoadId}
                onChange={(e) => setHomeRoadId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-teal-500"
              >
                <option value="">-- Select Origin Corridor --</option>
                {roads.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.road_name} ({r.zone})
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Corridor */}
            <div>
              <label className="block font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <FaMapMarkerAlt className="text-rose-400 text-xs" /> Work / Destination Corridor
              </label>
              <select
                value={workRoadId}
                onChange={(e) => setWorkRoadId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-teal-500"
              >
                <option value="">-- Select Destination Corridor --</option>
                {roads.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.road_name} ({r.zone})
                  </option>
                ))}
              </select>
            </div>

            {/* Estimated Output Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between font-mono">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Route Speed Vector</span>
                <span className="font-bold text-emerald-400 text-sm flex items-center gap-1 mt-0.5">
                  <FaCarSide /> {commuteCalc?.avgSpd || 0} km/h avg
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Route Status</span>
                {commuteCalc?.hasDelay ? (
                  <span className="text-amber-400 font-bold text-xs">Moderate Delays</span>
                ) : (
                  <span className="text-emerald-400 font-bold text-xs">Smooth Flow</span>
                )}
              </div>
            </div>

          </div>
        </Card>

        {/* Top Metric Cards (6 Summary Counters) */}
        {loading && !stats ? (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            
            {/* Card 1: Total Roads */}
            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Monitored Roads</span>
                <FaRoad className="text-teal-400 text-sm" />
              </div>
              <div className="text-2xl font-black text-slate-100 font-mono mt-2">
                {stats?.total_monitored_roads || 0}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">Active Corridors</span>
            </div>

            {/* Card 2: Low Congestion */}
            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Low Traffic</span>
                <FaCheckCircle className="text-emerald-400 text-sm" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-2">
                {stats?.low_congestion_count || 0}
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-1">Free-Flowing</span>
            </div>

            {/* Card 3: Moderate Congestion */}
            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Moderate</span>
                <FaClock className="text-amber-400 text-sm" />
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-2">
                {stats?.moderate_congestion_count || 0}
              </div>
              <span className="text-[10px] text-amber-400/80 mt-1">Normal Volume</span>
            </div>

            {/* Card 4: High Congestion */}
            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">High Congestion</span>
                <FaExclamationTriangle className="text-orange-400 text-sm" />
              </div>
              <div className="text-2xl font-black text-orange-400 font-mono mt-2">
                {stats?.high_congestion_count || 0}
              </div>
              <span className="text-[10px] text-orange-400/80 mt-1">Slow Movement</span>
            </div>

            {/* Card 5: Critical Congestion */}
            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Critical</span>
                <FaExclamationTriangle className="text-rose-500 text-sm" />
              </div>
              <div className="text-2xl font-black text-rose-500 font-mono mt-2">
                {stats?.critical_congestion_count || 0}
              </div>
              <span className="text-[10px] text-rose-400/80 mt-1">Heavy Delays</span>
            </div>

            {/* Card 6: Active Alerts */}
            <div 
              onClick={() => navigate('/public/alerts')}
              className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between cursor-pointer hover:border-amber-500/60 transition-all hover:scale-[1.02]"
            >
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Active Advisories</span>
                <FaExclamationTriangle className="text-amber-400 text-sm" />
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-2">
                {stats?.active_public_alerts_count || 0}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">Public Warnings</span>
            </div>

          </div>
        )}

        {/* Data Provenance & Timestamp Bar */}
        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2 font-mono">
          <div className="flex items-center space-x-2">
            <FaShieldAlt className="text-teal-400" />
            <span>DATA SOURCE: <strong className="text-slate-200 font-sans">Supabase Telemetry Database</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <span>LAST UPDATED:</span>
            <strong className="text-emerald-400">
              {formatTimeSafely(stats?.last_updated_at)}
            </strong>
          </div>
        </div>

        {/* Monitored Corridors Real-time Status Table */}
        <Card 
          title="City Corridor Traffic Roster" 
          subtitle="Real-time vehicle volume, speed, and congestion level by corridor (Click ⭐ to pin to your dashboard)"
        >
          {loading && roads.length === 0 ? (
            <SkeletonTable rows={6} />
          ) : error ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <FaExclamationTriangle className="text-3xl text-rose-500 mx-auto" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase bg-slate-900/90 text-slate-400 border-b border-slate-800 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-3 text-center whitespace-nowrap">Pin</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Corridor Code</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Road Name</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Zone</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Vehicle Count</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Avg Speed</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Congestion Level</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Last Updated</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {roads.map((r) => {
                    const isFav = Array.isArray(favorites) && favorites.includes(r.id);
                    return (
                      <tr key={r.id} className="hover:bg-slate-900/50 transition-colors">
                        
                        {/* Pin ⭐ */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => toggleFavorite(r.id)}
                            className="p-1 hover:scale-125 transition-transform text-slate-500 hover:text-amber-400"
                            title={isFav ? 'Unpin corridor' : 'Pin to My Saved Corridors'}
                          >
                            {isFav ? <FaStar className="text-amber-400" /> : <FaRegStar />}
                          </button>
                        </td>

                        {/* Code */}
                        <td className="py-3.5 px-4 font-mono font-bold text-teal-400 whitespace-nowrap">
                          {r.road_code}
                        </td>

                        {/* Name */}
                        <td className="py-3.5 px-4 font-bold text-slate-100 whitespace-nowrap">
                          {r.road_name}
                        </td>

                        {/* Zone */}
                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                          <span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-xs">
                            {r.zone}
                          </span>
                        </td>

                        {/* Vehicles */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-200 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <FaCar className="text-slate-500 text-xs" /> {r.vehicle_count || 0} veh
                          </span>
                        </td>

                        {/* Speed */}
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <FaTachometerAlt className="text-emerald-500/70 text-xs" /> {r.average_speed || 0} km/h
                          </span>
                        </td>

                        {/* Congestion Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={r.congestion_level} type={getCongestionType(r.congestion_level)} />
                        </td>

                        {/* Updated */}
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                          {formatTimeSafely(r.last_updated_at)}
                        </td>

                        {/* Read-Only Details */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Link
                            to="/public/roads"
                            className="inline-flex items-center space-x-1 text-xs text-teal-400 hover:text-teal-300 font-semibold"
                          >
                            <span>Inspect</span>
                            <FaArrowRight className="text-[10px]" />
                          </Link>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
    </PublicLayout>
  );
};
