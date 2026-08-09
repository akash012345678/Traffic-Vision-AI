import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CongestionBadge } from '../components/common/CongestionBadge';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import { FaRoad, FaMapMarkerAlt, FaUserTie, FaCar, FaTachometerAlt, FaClock, FaArrowLeft, FaSync, FaPlay, FaVideo } from 'react-icons/fa';
import { useLiveTelemetry } from '../hooks/useLiveTelemetry';
import { AIVideoModal } from '../components/traffic/AIVideoModal';

export const RoadDetailsPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [roadData, setRoadData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const { data: liveStreamData } = useLiveTelemetry(id, !!id, 1200);

  const fetchRoadDetails = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get(`/traffic/roads/${id}`);
      setRoadData(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load road details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoadDetails();
  }, [id]);

  const activeRoadData = liveStreamData ? { ...roadData, ...liveStreamData } : roadData;

  const LayoutWrapper = user ? DashboardLayout : MainLayout;
  const layoutProps = user ? { role: user.role } : {};

  return (
    <LayoutWrapper {...layoutProps}>
      <div className="space-y-6 w-full">
        
        {/* Navigation Back */}
        <div className="flex items-center justify-between">
          <Link 
            to={user?.role === 'Admin' ? '/admin/monitoring' : '/operator/monitoring'}
            className="inline-flex items-center space-x-2 text-xs text-teal-400 hover:text-teal-300 font-medium"
          >
            <FaArrowLeft />
            <span>Back to Traffic Monitoring</span>
          </Link>

          <Button variant="secondary" size="sm" onClick={fetchRoadDetails} className="space-x-1.5">
            <FaSync className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh Corridor</span>
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg">
            {error}
          </div>
        )}

        {isLoading && !activeRoadData ? (
          <div className="py-16 text-center text-xs font-mono text-slate-400">Loading road corridor details...</div>
        ) : activeRoadData ? (
          <>
            {/* Header Information Card */}
            <Card className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl">
                      <FaRoad className="text-2xl" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h1 className="text-2xl font-extrabold text-slate-100">{activeRoadData.road_name}</h1>
                        <span className="bg-teal-500/10 border border-teal-500/20 text-teal-400 font-mono text-xs px-2 py-0.5 rounded font-bold">
                          {activeRoadData.road_code || `RD-${activeRoadData.road_id}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{activeRoadData.zone}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIsVideoModalOpen(true)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all transform hover:scale-105"
                  >
                    <FaPlay className="text-[10px]" />
                    <span>▶ View AI Video</span>
                  </button>
                  <CongestionBadge level={activeRoadData.current_telemetry?.congestion_level} />
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4 text-xs">
                <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <FaMapMarkerAlt className="text-teal-400 text-lg shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">GPS Coordinates</span>
                    <span className="font-mono text-slate-200">
                      {activeRoadData.latitude?.toFixed(4)}, {activeRoadData.longitude?.toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <FaUserTie className="text-emerald-400 text-lg shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Assigned Operator</span>
                    <span className="font-medium text-slate-200">{activeRoadData.assigned_operator?.name || 'Unassigned'}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Corridor Specs</span>
                    <span className="font-mono text-slate-200">
                      {activeRoadData.length_km || 2.5} km | {activeRoadData.lanes || 4} lanes | {activeRoadData.speed_limit || 60} km/h
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <FaClock className="text-cyan-400 text-lg shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Telemetry Timestamp</span>
                    <span className="font-mono text-slate-200">
                      {activeRoadData.current_telemetry?.timestamp 
                        ? new Date(activeRoadData.current_telemetry.timestamp).toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Current Live Telemetry Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card title="Live Vehicle Volume" subtitle="Real-time flow count">
                <div className="flex items-center justify-between mt-2">
                  <span className="text-3xl font-extrabold text-teal-400 font-mono">
                    {activeRoadData.current_telemetry?.vehicle_count ?? 0}
                  </span>
                  <FaCar className="text-3xl text-slate-700" />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">Vehicles currently detected on corridor</p>
              </Card>

              <Card title="Corridor Speed Average" subtitle="Measured vehicle speed">
                <div className="flex items-center justify-between mt-2">
                  <span className="text-3xl font-extrabold text-cyan-400 font-mono">
                    {activeRoadData.current_telemetry?.average_speed ?? 0.0} <span className="text-xs font-normal">km/h</span>
                  </span>
                  <FaTachometerAlt className="text-3xl text-slate-700" />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">Average corridor speed vector</p>
              </Card>

              <Card title="Congestion Level" subtitle="Current status classification">
                <div className="flex items-center justify-between mt-2">
                  <CongestionBadge level={activeRoadData.current_telemetry?.congestion_level} />
                </div>
                <p className="text-[11px] text-slate-400 mt-3 font-mono">Classification evaluated from telemetry</p>
              </Card>

              <Card title="AI Integration Status" subtitle="AI detection telemetry source">
                <div className="flex items-center justify-between mt-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    activeRoadData.current_telemetry?.ai_status === 'ACTIVE'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {activeRoadData.current_telemetry?.ai_status || 'SEEDED'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-5 font-mono">
                  {activeRoadData.current_telemetry?.ai_status === 'ACTIVE' 
                    ? `Active (Conf: ${Math.round((activeRoadData.current_telemetry.confidence || 0) * 100)}%)` 
                    : 'Simulated Seed Database'}
                </p>
              </Card>
            </div>

            {/* Recent Alerts Section */}
            {activeRoadData.recent_alerts && activeRoadData.recent_alerts.length > 0 && (
              <Card title="Recent Corridor Alerts" subtitle="Alerts generated for this road corridor">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-[11px] uppercase bg-slate-900/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Alert ID</th>
                        <th className="py-3 px-4">Alert Type</th>
                        <th className="py-3 px-4">Severity</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Created Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {activeRoadData.recent_alerts.map((alt) => (
                        <tr key={alt.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 text-slate-400">#ALT-{alt.id}</td>
                          <td className="py-3 px-4 text-slate-200 font-sans font-bold">{alt.alert_type}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              alt.severity === 'Critical' ? 'bg-rose-500/20 text-rose-400' :
                              alt.severity === 'High' ? 'bg-orange-500/20 text-orange-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>{alt.severity}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{alt.status}</td>
                          <td className="py-3 px-4 text-slate-400">
                            {alt.created_at ? new Date(alt.created_at).toLocaleString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Historical Telemetry Logs Table */}
            <Card title="Telemetry Logs History" subtitle="Recent 15 sensor readings from database">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="text-[11px] uppercase bg-slate-900/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Log ID</th>
                      <th className="py-3 px-4">Vehicle Count</th>
                      <th className="py-3 px-4">Average Speed</th>
                      <th className="py-3 px-4">Congestion Level</th>
                      <th className="py-3 px-4">Log Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {activeRoadData.telemetry_history?.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400">#LOG-{log.id}</td>
                        <td className="py-3 px-4 text-teal-400 font-bold">{log.vehicle_count} veh</td>
                        <td className="py-3 px-4 text-slate-200">{log.average_speed} km/h</td>
                        <td className="py-3 px-4">
                          <CongestionBadge level={log.congestion_level} />
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : null}

        {/* AI Video Viewer Modal */}
        <AIVideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          roadId={id}
          roadName={activeRoadData?.road_name}
        />

      </div>
    </LayoutWrapper>
  );
};
