import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { SkeletonMetric, SkeletonTable } from '../components/ui/Skeleton';
import { useToast } from '../contexts/ToastContext';
import apiClient from '../services/api';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  FaRoad, FaUserTie, FaVideo, FaExclamationTriangle, FaTachometerAlt, 
  FaCar, FaCheckCircle, FaSync, FaShieldAlt, FaHistory, FaFire 
} from 'react-icons/fa';

export const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showError, showSuccess } = useToast();

  const fetchControlCenterStats = async (isManual = false) => {
    setIsLoading(true);
    try {
      const [res, analRes] = await Promise.all([
        apiClient.get('/admin/dashboard-stats'),
        apiClient.get('/analytics/details')
      ]);
      setData(res);
      setAnalytics(analRes);
      if (isManual) {
        showSuccess('Traffic Control Center telemetry and AI analytics synced', 'Live Telemetry');
      }
    } catch (err) {
      showError(err.message || 'Failed to connect to Traffic Control Center backend');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchControlCenterStats();

    // Auto refresh every 1.5 seconds for live real-time telemetry synchronization
    const timer = setInterval(() => {
      fetchControlCenterStats();
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  const summary = data?.summary_metrics || {};
  
  // Daily Congestion Trends (from analytics)
  const trends = analytics?.daily_trends || [];

  // Vehicle Distribution (from analytics)
  const pieColors = ['#10b981', '#38bdf8', '#fbbf24', '#f87171'];
  const pieData = analytics?.vehicle_distribution?.map((item, idx) => ({
    name: item.class_name,
    value: item.count,
    color: pieColors[idx % pieColors.length]
  })) || [];

  const getStatusBadge = (status) => {
    if (status === 'Optimal') return 'green';
    if (status === 'Elevated Traffic') return 'amber';
    return 'red';
  };

  return (
    <DashboardLayout role="Admin">
      <div className="space-y-6 w-full animate-fade-in">

        {/* Top Control Room Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-4 rounded-xl border border-slate-800 w-full">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <span>Smart City Traffic Control Center</span>
                <span className="text-xs font-mono font-normal text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800">
                  HUB-NODE #01 • SUPABASE LIVE
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live telemetry command desk • Real-time traffic monitoring, signal optimization, and operator coordination.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right text-xs font-mono hidden sm:block">
              <span className="text-slate-400 block text-[10px] uppercase">Engine Health</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <FaCheckCircle /> {summary.system_status || 'Optimal'}
              </span>
            </div>

            <Link
              to="/admin/heatmap"
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold flex items-center space-x-2 transition-all shadow-md shadow-amber-500/20 shrink-0"
            >
              <FaFire className="text-sm" />
              <span>Traffic Heatmap Console</span>
            </Link>
            
            <Button variant="secondary" size="sm" onClick={() => fetchControlCenterStats(true)} className="space-x-1.5">
              <FaSync className={isLoading ? 'animate-spin' : ''} />
              <span>Sync Telemetry</span>
            </Button>
          </div>
        </div>

        {/* ROW 1: ALL 8 SUMMARY CARDS (Spans 100% width, 8 columns on desktop) */}
        {isLoading && !data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4 w-full">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonMetric key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4 w-full">
            
            {/* Card 1: Total Roads */}
            <Card className="hover:border-teal-500/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Corridors</p>
                  <h3 className="text-2xl font-extrabold text-slate-100 font-mono mt-1">{summary.total_roads || 0}</h3>
                  <p className="text-[10px] text-teal-400 mt-1 font-medium truncate">Active Corridors</p>
                </div>
                <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl shrink-0">
                  <FaRoad className="text-xl" />
                </div>
              </div>
            </Card>

            {/* Card 2: Total Operators */}
            <Card className="hover:border-emerald-500/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Operators</p>
                  <h3 className="text-2xl font-extrabold text-slate-100 font-mono mt-1">{summary.total_operators || 0}</h3>
                  <p className="text-[10px] text-emerald-400 mt-1 font-medium truncate">Duty Roster</p>
                </div>
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
                  <FaUserTie className="text-xl" />
                </div>
              </div>
            </Card>

            {/* Card 3: Traffic Cameras */}
            <Card className="hover:border-cyan-500/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cameras</p>
                  <h3 className="text-2xl font-extrabold text-cyan-400 font-mono mt-1">{summary.total_cameras || 0}</h3>
                  <p className="text-[10px] text-cyan-400 mt-1 font-medium truncate">Sub-120ms Feeds</p>
                </div>
                <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl shrink-0">
                  <FaVideo className="text-xl" />
                </div>
              </div>
            </Card>

            {/* Card 4: Active Alerts */}
            <Card className="hover:border-rose-500/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Alerts</p>
                  <h3 className="text-2xl font-extrabold text-rose-400 font-mono mt-1">{summary.active_alerts || 0}</h3>
                  <p className="text-[10px] text-rose-400 mt-1 font-medium truncate">Unresolved</p>
                </div>
                <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl shrink-0">
                  <FaExclamationTriangle className="text-xl" />
                </div>
              </div>
            </Card>

            {/* Card 5: High Congestion */}
            <Card className="hover:border-amber-500/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">High Congestion</p>
                  <h3 className="text-2xl font-extrabold text-amber-400 font-mono mt-1">{summary.high_congestion_roads || 0}</h3>
                  <p className="text-[10px] text-amber-400 mt-1 font-medium truncate">Heavy Corridors</p>
                </div>
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl shrink-0">
                  <FaTachometerAlt className="text-xl" />
                </div>
              </div>
            </Card>

            {/* Card 6: Average Vehicle Count */}
            <Card className="hover:border-teal-500/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Avg Vehicles</p>
                  <h3 className="text-2xl font-extrabold text-teal-300 font-mono mt-1">{summary.avg_vehicle_count || 0}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium truncate">Vehicles / Road</p>
                </div>
                <div className="p-2.5 bg-teal-500/10 text-teal-300 rounded-xl shrink-0">
                  <FaCar className="text-xl" />
                </div>
              </div>
            </Card>

            {/* Card 7: Average Speed */}
            <Card className="hover:border-sky-500/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Avg Speed</p>
                  <h3 className="text-2xl font-extrabold text-sky-400 font-mono mt-1">{summary.avg_speed || 0} <span className="text-[10px] font-normal">km/h</span></h3>
                  <p className="text-[10px] text-sky-400 mt-1 font-medium truncate">Network Speed</p>
                </div>
                <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl shrink-0">
                  <FaTachometerAlt className="text-xl" />
                </div>
              </div>
            </Card>

            {/* Card 8: System Status */}
            <Card className="hover:border-emerald-500/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Health</p>
                  <div className="mt-2">
                    <StatusBadge status={summary.system_status || 'Optimal'} type={getStatusBadge(summary.system_status)} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium truncate">System State</p>
                </div>
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
                  <FaShieldAlt className="text-xl" />
                </div>
              </div>
            </Card>

          </div>
        )}

        {/* ROW 2: CHARTS (70% Trend Chart, 30% Congestion Distribution) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          
          {/* Trend Chart (70% = 8 cols out of 12) */}
          <Card title="Daily Traffic & Congestion Trends" subtitle="7-day average vehicle volumes and speed trends from Supabase" className="lg:col-span-8">
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="avg_vehicles" name="Average Vehicles" stroke="#14b8a6" fillOpacity={1} fill="url(#colorVehicles)" strokeWidth={2} />
                  <Area type="monotone" dataKey="avg_speed" name="Average Speed (km/h)" stroke="#38bdf8" fillOpacity={1} fill="url(#colorSpeed)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Vehicle Distribution Pie Chart (30% = 4 cols out of 12) */}
          <Card title="Vehicle Distribution" subtitle="Class-wise AI telemetry splits from Supabase" className="lg:col-span-4">
            <div className="h-72 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} 
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

        </div>

        {/* ROW 2.5: AI ANALYTICS CHARTS (70% Hourly Traffic trends, 30% Peak traffic & Busiest Corridor) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full animate-fade-in">
          
          {/* Hourly Traffic Flow Bar Chart (70% = 8 cols out of 12) */}
          <Card title="Hourly Traffic Trends" subtitle="Average vehicle flow profile by hour of the day from Supabase" className="lg:col-span-8">
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.hourly_trends || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="hour" stroke="#64748b" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => [`${value} vehicles`, 'Avg Volume']}
                  />
                  <Bar dataKey="avg_vehicles" name="Average Vehicles" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Peak traffic hours & Top Road Segment (30% = 4 cols out of 12) */}
          <Card title="Peak Hours & Top Corridors" subtitle="System-wide peak loads & busiest segments" className="lg:col-span-4">
            <div className="space-y-6 pt-2 font-sans">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <FaHistory className="text-teal-400" /> Busiest Peak Time Slots
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {analytics?.peak_hours?.map((item, idx) => (
                    <div key={idx} className="bg-slate-900/90 border border-slate-800/80 p-2.5 rounded-xl text-center font-mono">
                      <span className="text-xs font-bold text-teal-400 block">{item.hour}:00</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{Math.round(item.avg_vehicles)} veh</span>
                    </div>
                  ))}
                  {(!analytics?.peak_hours || analytics.peak_hours.length === 0) && (
                    <div className="col-span-3 text-center text-xs text-slate-500 py-2">No peak metrics</div>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <FaRoad className="text-teal-400" /> Busiest Road Corridors
                </span>
                <div className="space-y-2">
                  {analytics?.road_wise?.slice(0, 2).map((road, idx) => (
                    <div key={idx} className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">{road.road_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{road.road_code}</span>
                      </div>
                      <span className="text-xs font-bold text-teal-400 font-mono bg-teal-500/10 px-2 py-1 rounded-lg border border-teal-500/20">
                        {Math.round(road.avg_vehicles)} veh/avg
                      </span>
                    </div>
                  ))}
                  {(!analytics?.road_wise || analytics.road_wise.length === 0) && (
                    <div className="text-center text-xs text-slate-500 py-2">No corridor metrics</div>
                  )}
                </div>
              </div>
            </div>
          </Card>

        </div>

        {/* ROW 3: LIVE TELEMETRY TABLE (70%) & RECENT ALERTS (30%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          
          {/* Live Telemetry Table (70% = 8 cols out of 12) */}
          <Card title="Live Telemetry Corridor Overview" subtitle="Real-time telemetry feeds from Supabase" className="lg:col-span-8">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase bg-slate-900/90 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Corridor Name</th>
                    <th className="py-3 px-4">Zone</th>
                    <th className="py-3 px-4">Vehicle Flow</th>
                    <th className="py-3 px-4">Congestion</th>
                    <th className="py-3 px-4">AI Status</th>
                    <th className="py-3 px-4">Updated Time</th>
                    <th className="py-3 px-4">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {data?.live_traffic_summary?.map((road) => (
                    <tr key={road.road_id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-100 flex items-center space-x-2 font-sans">
                        <FaRoad className="text-teal-400 shrink-0" />
                        <span>{road.road_name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-sans">{road.zone}</td>
                      <td className="py-3.5 px-4 text-teal-400 font-bold">{road.vehicle_count} veh</td>
                      <td className="py-3.5 px-4 font-sans">
                        <StatusBadge 
                          status={road.congestion_level} 
                          type={road.congestion_level === 'High' || road.congestion_level === 'Critical' || road.congestion_level === 'Severe' ? 'red' : 'green'} 
                        />
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          road.ai_status === 'ACTIVE' 
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' 
                            : 'bg-slate-800/80 text-slate-400 border-slate-700'
                        }`}>
                          {road.ai_status || 'SEEDED'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {road.timestamp ? new Date(road.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-sans">{road.assigned_operator_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Incident Queue (30% = 4 cols out of 12) */}
          <Card title="Incident Dispatch Queue" subtitle="Active unhandled alerts" className="lg:col-span-4">
            <div className="space-y-3">
              {data?.recent_alerts?.map((alert) => (
                <div key={alert.id} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-100">
                    <span>{alert.alert_type}</span>
                    <StatusBadge status={alert.severity} type={alert.severity === 'High' || alert.severity === 'Critical' ? 'red' : 'amber'} />
                  </div>
                  <p className="text-[11px] text-slate-400">{alert.road_name} ({alert.zone})</p>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1">
                    <span>Status: {alert.status}</span>
                    <span>{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>

        {/* ROW 4: DUTY ROSTER (50%) & SYSTEM AUDIT LOGS (50%) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          
          {/* Operator Duty Roster */}
          <Card title="Control Room Duty Roster" subtitle="Operator personnel allocations">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {data?.operator_activity?.map((op) => (
                <div key={op.id} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 font-bold flex items-center justify-center text-xs shrink-0">
                      {op.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 truncate">{op.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{op.email}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/30 shrink-0 ml-2">
                    {op.assigned_road_count} Roads
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* System Audit Activity Log */}
          <Card title="System Audit Event Stream" subtitle="Real-time Control Center audit logs">
            <div className="space-y-2.5 text-xs font-mono">
              {data?.recent_system_activity?.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center space-x-2 text-slate-300 min-w-0">
                    <FaHistory className="text-teal-400 text-xs shrink-0" />
                    <span className="truncate">{item.text}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">{item.timestamp}</span>
                </div>
              ))}
            </div>
          </Card>

        </div>

      </div>
    </DashboardLayout>
  );
};
