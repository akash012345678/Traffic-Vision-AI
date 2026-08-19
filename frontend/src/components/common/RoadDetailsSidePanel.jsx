import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { StatusBadge } from './StatusBadge';
import { Button } from '../ui/Button';
import { useLiveTelemetry } from '../../hooks/useLiveTelemetry';
import { AIVideoModal } from '../traffic/AIVideoModal';
import apiClient from '../../services/api';
import { 
  FaRoad, 
  FaTimes, 
  FaSync, 
  FaMapMarkerAlt, 
  FaUserTie, 
  FaClock,
  FaChartLine,
  FaCar,
  FaTachometerAlt,
  FaExclamationTriangle,
  FaShieldAlt,
  FaCheckCircle,
  FaLayerGroup,
  FaRulerHorizontal,
  FaBrain,
  FaVideo,
  FaBus,
  FaTruck,
  FaMotorcycle,
  FaPlay,
  FaRoute
} from 'react-icons/fa';

// Alternate Route Recommendation Card Sub-component
const AlternateRouteCard = ({ targetRoadId }) => {
  const [altRec, setAltRec] = useState(null);

  useEffect(() => {
    if (targetRoadId) {
      apiClient.get(`/routes/alternatives?road_id=${targetRoadId}`)
        .then(res => setAltRec(res))
        .catch(() => setAltRec(null));
    } else {
      setAltRec(null);
    }
  }, [targetRoadId]);

  if (!altRec || !altRec.recommendation_available) return null;

  const curR = altRec.current_route || {};
  const recR = altRec.recommended_alternative || {};

  return (
    <div className="glass-panel p-4 rounded-xl border border-amber-500/40 bg-amber-950/10 space-y-2.5 font-mono">
      <div className="flex justify-between items-center border-b border-amber-500/20 pb-2">
        <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
          <FaRoute className="text-amber-400" />
          <span>Traffic-Aware Alternate Corridor</span>
        </span>
        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
          Saves {altRec.time_saved_minutes} min
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/80 p-3 rounded-lg border border-slate-800">
        <div>
          <span className="text-[9px] text-slate-500 block uppercase">CURRENT CORRIDOR</span>
          <span className="font-bold text-slate-200 block truncate">{curR.road_name}</span>
          <span className="text-[10px] text-amber-400 block">{curR.travel_time_minutes} min ({curR.congestion})</span>
        </div>

        <div className="border-l border-slate-800 pl-2">
          <span className="text-[9px] text-emerald-400 font-bold block uppercase">RECOMMENDED ALT</span>
          <span className="font-bold text-emerald-300 block truncate">{recR.road_name}</span>
          <span className="text-[10px] text-emerald-400 block">{recR.travel_time_minutes} min ({recR.congestion})</span>
        </div>
      </div>

      <p className="text-[11px] text-slate-300 font-sans leading-relaxed bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
        {altRec.recommendation_explanation}
      </p>
    </div>
  );
};

export const RoadDetailsSidePanel = ({ isOpen, onClose, roadData, isLoading, error, onRetry }) => {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const targetRoadId = roadData?.id || roadData?.road_id;
  const { data: liveStreamData } = useLiveTelemetry(targetRoadId, isOpen, 1200);

  // Lock body overflow & listen for ESC key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Merge live stream telemetry if available for continuous AI updates
  const activeRoadData = liveStreamData ? { ...roadData, ...liveStreamData } : roadData;
  const historyLogs = activeRoadData?.telemetry_history || [];
  const activeAlerts = activeRoadData?.recent_alerts || activeRoadData?.alerts || [];
  const assignedOp = activeRoadData?.assigned_operator;
  const currentTelemetry = activeRoadData?.current_telemetry || {};

  const getCongestionBadgeType = (level) => {
    switch ((level || '').toUpperCase()) {
      case 'LOW': return 'green';
      case 'MODERATE': return 'amber';
      case 'HIGH':
      case 'CRITICAL': return 'red';
      default: return 'green';
    }
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-auto">
      {/* Semi-transparent Backdrop Overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
      />

      {/* Slide-over Right Information Panel Drawer */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 max-w-full flex pl-10"
      >
        <div className="w-screen max-w-md sm:max-w-xl bg-slate-950/95 border-l border-slate-800/80 backdrop-blur-xl shadow-2xl flex flex-col h-full animate-slide-left font-sans">
          
          {/* 1. Panel Fixed Header */}
          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <FaRoad className="text-xl" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-slate-100 truncate max-w-[240px] sm:max-w-[320px]">
                    {roadData?.road_name || 'Corridor Telemetry Specifications'}
                  </h2>
                  {roadData?.road_code && (
                    <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 shrink-0">
                      {roadData.road_code}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <span>Zone:</span> <strong className="text-slate-200">{roadData?.zone || 'Zone Corridor'}</strong>
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
              title="Close Drawer Panel (ESC)"
            >
              <FaTimes className="text-base" />
            </button>
          </div>

          {/* 2. Scrollable Panel Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            
            {/* Loading State */}
            {isLoading ? (
              <div className="py-20 text-center space-y-3">
                <FaSync className="animate-spin text-3xl text-teal-400 mx-auto" />
                <p className="text-slate-300 font-semibold text-sm">Syncing Live Telemetry & Corridor Records...</p>
                <p className="text-[11px] text-slate-500">Querying Supabase PostgreSQL real-time engine</p>
              </div>
            ) : error ? (
              /* Error State */
              <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-center space-y-3">
                <FaExclamationTriangle className="text-3xl text-rose-400 mx-auto" />
                <h4 className="font-bold text-slate-100 text-sm">Failed to Load Telemetry Specifications</h4>
                <p className="text-[11px] text-rose-300">{error}</p>
                {onRetry && (
                  <Button size="sm" onClick={onRetry} className="bg-rose-500 hover:bg-rose-600 text-white font-bold">
                    Retry Sync
                  </Button>
                )}
              </div>
            ) : !roadData ? (
              /* Empty State */
              <div className="py-16 text-center text-slate-500 space-y-2">
                <FaRoad className="text-4xl text-slate-700 mx-auto" />
                <p className="font-bold text-slate-400">No Road Selected</p>
              </div>
            ) : (
              <>
                {/* SECTION 1: ROAD DETAILS */}
                <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <FaMapMarkerAlt className="text-rose-400 text-sm" />
                    <span>Road Corridor Metadata</span>
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono text-[11px]">
                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                      <span className="text-[9px] text-slate-500 font-sans uppercase block">GPS Latitude</span>
                      <span className="font-bold text-slate-200">{roadData.latitude || '12.9716'}</span>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                      <span className="text-[9px] text-slate-500 font-sans uppercase block">GPS Longitude</span>
                      <span className="font-bold text-slate-200">{roadData.longitude || '77.5946'}</span>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                      <span className="text-[9px] text-slate-500 font-sans uppercase block">Speed Limit</span>
                      <span className="font-bold text-teal-400">{roadData.speed_limit || 60} km/h</span>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                      <span className="text-[9px] text-slate-500 font-sans uppercase block">Traffic Lanes</span>
                      <span className="font-bold text-slate-200">{roadData.lanes || 4} Lanes</span>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                      <span className="text-[9px] text-slate-500 font-sans uppercase block">Length</span>
                      <span className="font-bold text-slate-200">{roadData.length_km || 2.5} km</span>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                      <span className="text-[9px] text-slate-500 font-sans uppercase block">Corridor Status</span>
                      <span className="font-bold text-emerald-400">{roadData.status || 'Active'}</span>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: ASSIGNED OPERATOR */}
                <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <FaUserTie className="text-teal-400 text-sm" />
                    <span>Assigned Duty Operator</span>
                  </h3>

                  {assignedOp ? (
                    <div className="flex items-center space-x-3.5 p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                      <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-extrabold shrink-0 text-base">
                        {assignedOp.name ? assignedOp.name.charAt(0) : 'O'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-100 text-sm truncate">{assignedOp.name}</h4>
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">
                            Active Duty
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{assignedOp.email}</p>
                        <p className="text-[10px] text-teal-400/80 font-mono mt-0.5">{assignedOp.shift || 'Day Shift (08:00 - 16:00)'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800/60 text-slate-400 text-center font-mono text-[11px]">
                      No operator currently assigned to this road corridor.
                    </div>
                  )}
                </div>

                {/* VIEW AI VIDEO ACTION BUTTON */}
                <div className="p-3.5 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 rounded-xl border border-blue-500/30 flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/40">
                      <FaVideo className="text-base" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">Live AI Video Telemetry</h4>
                      <p className="text-[10px] text-slate-400">YOLOv8 frame-accurate synchronized analysis</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsVideoModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md flex items-center gap-1.5 transition-all transform hover:scale-105"
                  >
                    <FaPlay className="text-[10px]" />
                    <span>View AI Video</span>
                  </button>
                </div>

                {/* SECTIONS 3, 4, 5: VEHICLE COUNT, AVERAGE SPEED, CONGESTION */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Vehicle Count Card */}
                  <div className="glass-panel p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Volume</span>
                      <FaCar className="text-cyan-400 text-sm" />
                    </div>
                    <h4 className="text-xl font-extrabold text-cyan-400 font-mono">
                      {currentTelemetry?.vehicle_count || 0} <span className="text-[10px] text-slate-500 font-normal">veh</span>
                    </h4>
                    <p className="text-[9px] text-slate-500 font-mono">Current Flow Rate</p>
                  </div>

                  {/* Average Speed Card */}
                  <div className="glass-panel p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Avg Speed</span>
                      <FaTachometerAlt className="text-teal-400 text-sm" />
                    </div>
                    <h4 className="text-xl font-extrabold text-slate-100 font-mono">
                      {currentTelemetry?.average_speed || 0} <span className="text-[10px] text-slate-500 font-normal">km/h</span>
                    </h4>
                    <p className="text-[9px] text-slate-500 font-mono">Sensors Telemetry</p>
                  </div>

                  {/* Congestion Status Card */}
                  <div className="glass-panel p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Congestion</span>
                      <FaExclamationTriangle className="text-amber-400 text-sm" />
                    </div>
                    <div className="mt-1">
                      <StatusBadge 
                        status={currentTelemetry?.congestion_level || 'Low'} 
                        type={getCongestionBadgeType(currentTelemetry?.congestion_level)} 
                      />
                    </div>
                    <p className="text-[9px] text-slate-500 font-mono">Density Level</p>
                  </div>

                </div>

                {/* TRAVEL-TIME ESTIMATION WIDGET (MILESTONE 2 PHASE 3) */}
                {(() => {
                  const len = parseFloat(roadData?.length_km || 2.5);
                  const limit = parseFloat(roadData?.speed_limit || 60);
                  const spd = parseFloat(currentTelemetry?.average_speed || 0);

                  if (spd <= 0) {
                    return (
                      <div className="glass-panel p-3.5 rounded-xl border border-slate-800 text-slate-400 text-center font-mono text-[11px]">
                        Travel time unavailable (Zero / missing telemetry speed)
                      </div>
                    );
                  }

                  const freeMins = ((len / limit) * 60).toFixed(1);
                  const curMins = ((len / Math.max(5, spd)) * 60).toFixed(1);
                  const delayMins = Math.max(0, curMins - freeMins).toFixed(1);

                  return (
                    <div className="glass-panel p-4 rounded-xl border border-teal-500/30 bg-teal-950/10 space-y-2.5 font-mono">
                      <div className="flex justify-between items-center border-b border-teal-500/20 pb-2">
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-2">
                          <FaClock className="text-teal-400" />
                          <span>Corridor Travel-Time Estimation</span>
                        </span>
                        <span className="text-[10px] text-teal-400 font-bold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/30">
                          {len} km Corridor
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                          <span className="text-[9px] text-slate-500 font-sans uppercase block">Free-Flow</span>
                          <span className="text-sm font-bold text-emerald-400">{freeMins} min</span>
                          <span className="text-[8px] text-slate-500 block">@ {limit} km/h</span>
                        </div>

                        <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                          <span className="text-[9px] text-slate-500 font-sans uppercase block">Current Est</span>
                          <span className="text-sm font-bold text-sky-400">{curMins} min</span>
                          <span className="text-[8px] text-slate-500 block">@ {spd} km/h</span>
                        </div>

                        <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                          <span className="text-[9px] text-slate-500 font-sans uppercase block">Traffic Delay</span>
                          <span className="text-sm font-bold text-amber-400">+{delayMins} min</span>
                          <span className="text-[8px] text-slate-500 block">Congestion Loss</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ALTERNATE ROUTE RECOMMENDATION CARD (MILESTONE 2 PHASE 4) */}
                <AlternateRouteCard targetRoadId={targetRoadId} />

                {/* AI VEHICLE BREAKDOWN PANEL (only shown when AI data is available) */}
                {currentTelemetry?.ai_status === 'ACTIVE' && (
                  <div className="glass-panel p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                        <FaBrain className="text-cyan-400 text-sm" />
                        <span>YOLOv8 AI Vehicle Breakdown</span>
                      </h3>
                      <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">
                        {currentTelemetry?.confidence ? `${(currentTelemetry.confidence * 100).toFixed(0)}% conf` : 'AI ACTIVE'}
                      </span>
                    </div>

                    {/* Vehicle class breakdown grid */}
                    <div className="grid grid-cols-2 gap-2 font-mono">
                      <div className="flex items-center gap-2.5 p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <FaCar className="text-emerald-400 text-xs" />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block">Cars</span>
                          <span className="text-base font-extrabold text-emerald-400">{currentTelemetry?.car_count ?? 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                        <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center shrink-0">
                          <FaBus className="text-sky-400 text-xs" />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block">Buses</span>
                          <span className="text-base font-extrabold text-sky-400">{currentTelemetry?.bus_count ?? 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                          <FaTruck className="text-purple-400 text-xs" />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block">Trucks</span>
                          <span className="text-base font-extrabold text-purple-400">{currentTelemetry?.truck_count ?? 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                          <FaMotorcycle className="text-amber-400 text-xs" />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block">Motorcycles</span>
                          <span className="text-base font-extrabold text-amber-400">{currentTelemetry?.motorcycle_count ?? 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Source video and processed timestamp */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-800">
                      {currentTelemetry?.video_name && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <FaVideo className="text-cyan-400 shrink-0" />
                          <span className="truncate">Source: <strong className="text-slate-200">{currentTelemetry.video_name}</strong></span>
                        </div>
                      )}
                      {currentTelemetry?.processed_at && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <FaClock className="text-teal-400 shrink-0" />
                          <span>Processed: <strong className="text-slate-300">{new Date(currentTelemetry.processed_at).toLocaleString()}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION 6: TELEMETRY HISTORY & VISUAL TREND */}
                <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <FaChartLine className="text-teal-400 text-sm" />
                      <span>Telemetry History & Speed Trend</span>
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">{historyLogs.length} Records</span>
                  </div>

                  {/* SVG Bar Chart Visualizer */}
                  {historyLogs.length > 0 && (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5">
                      <div className="h-24 w-full flex items-end justify-between gap-1 pt-2">
                        {historyLogs.map((log, idx) => {
                          const maxVehicles = Math.max(...historyLogs.map(l => l.vehicle_count || 1), 100);
                          const barHeight = Math.max(15, Math.round(((log.vehicle_count || 0) / maxVehicles) * 100));

                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                              <div 
                                style={{ height: `${barHeight}%` }}
                                className="w-full max-w-[16px] bg-gradient-to-t from-teal-600/40 to-teal-400 rounded-t transition-all duration-300 group-hover:from-teal-500 group-hover:to-teal-300"
                              />
                              <span className="text-[8px] font-mono text-slate-500 truncate w-full text-center">
                                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : idx + 1}
                              </span>

                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-1.5 hidden group-hover:block z-20 bg-slate-900 text-[10px] text-slate-200 p-2 rounded-lg border border-teal-500/40 shadow-2xl whitespace-nowrap font-mono">
                                <div>Count: <strong className="text-teal-400">{log.vehicle_count}</strong> veh</div>
                                <div>Speed: <strong className="text-slate-100">{log.average_speed}</strong> km/h</div>
                                <div>Status: <strong className="text-amber-400">{log.congestion_level}</strong></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Telemetry Logs Table */}
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 font-mono text-[11px]">
                    <table className="w-full text-left text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Time</th>
                          <th className="py-2 px-3">Vehicles</th>
                          <th className="py-2 px-3">Speed</th>
                          <th className="py-2 px-3">Level</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {historyLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-500 italic">No historical telemetry logs available.</td>
                          </tr>
                        ) : (
                          historyLogs.map((h) => (
                            <tr key={h.id || h.timestamp} className="hover:bg-slate-900/60 transition-colors">
                              <td className="py-1.5 px-3 text-slate-400">{h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Recent'}</td>
                              <td className="py-1.5 px-3 text-teal-400 font-bold">{h.vehicle_count} veh</td>
                              <td className="py-1.5 px-3 text-slate-200">{h.average_speed} km/h</td>
                              <td className="py-1.5 px-3 font-bold">
                                <span className={h.congestion_level === 'Critical' || h.congestion_level === 'High' ? 'text-rose-400' : 'text-amber-300'}>
                                  {h.congestion_level}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 7: ALERTS */}
                <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <FaExclamationTriangle className="text-rose-400 text-sm" />
                      <span>Active Corridor Alerts</span>
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">{activeAlerts.length} Active</span>
                  </div>

                  {activeAlerts.length === 0 ? (
                    <div className="p-3.5 bg-slate-900/50 rounded-xl border border-slate-800/60 text-slate-400 text-center font-mono text-[11px] flex items-center justify-center gap-2">
                      <FaCheckCircle className="text-emerald-400" />
                      <span>No active incidents registered for this road corridor.</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activeAlerts.map((alert) => (
                        <div key={alert.id} className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-100 text-xs">{alert.alert_type}</span>
                            <StatusBadge status={alert.severity || 'Medium'} type={alert.severity === 'Critical' || alert.severity === 'High' ? 'red' : 'amber'} />
                          </div>
                          {alert.notes && <p className="text-[11px] text-slate-400">{alert.notes}</p>}
                          <p className="text-[9px] text-slate-500 font-mono">
                            Logged: {alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Recent'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </>
            )}

          </div>

          {/* 3. Panel Fixed Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-between items-center shrink-0">
            <span className="text-[10px] text-slate-500 font-mono">Supabase PostgreSQL Engine v1.0</span>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close Panel
            </Button>
          </div>

        </div>
      </div>

      <AIVideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        roadId={targetRoadId}
        roadName={roadData?.road_name}
      />
    </div>,
    document.body
  );
};
