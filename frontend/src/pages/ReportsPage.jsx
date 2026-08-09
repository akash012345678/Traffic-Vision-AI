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
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  FaChartBar,
  FaRoad,
  FaUserTie,
  FaLayerGroup,
  FaExclamationTriangle,
  FaSync,
  FaCheckCircle,
  FaFileDownload,
  FaTachometerAlt,
  FaCar,
  FaMotorcycle,
  FaBus,
  FaTruck,
  FaFilter,
  FaDatabase,
  FaClock,
  FaChartLine,
  FaExchangeAlt,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaLightbulb,
  FaShieldAlt,
  FaRoute,
  FaInfoCircle,
  FaExternalLinkAlt
} from 'react-icons/fa';

export const ReportsPage = () => {
  const { showError, showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState('reports'); // 'reports', 'trends', 'recommendations'

  // Operational & Telemetry Report States
  const [operationalReports, setOperationalReports] = useState(null);
  const [trafficReports, setTrafficReports] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States for Reports
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedCongestion, setSelectedCongestion] = useState('ALL');
  const [selectedRoadId, setSelectedRoadId] = useState('ALL');

  // Trend Analysis States
  const [trendRoadId, setTrendRoadId] = useState('ALL');
  const [trendTimeRange, setTrendTimeRange] = useState('24h');
  const [trendData, setTrendData] = useState(null);
  const [isTrendLoading, setIsTrendLoading] = useState(false);

  // Recommendation Engine States
  const [recommendationList, setRecommendationList] = useState([]);
  const [recCategoryFilter, setRecCategoryFilter] = useState('ALL');
  const [isRecLoading, setIsRecLoading] = useState(false);

  const fetchAllReports = async (isManual = false) => {
    setIsLoading(true);
    try {
      let trafficUrl = '/reports/traffic?limit=25';
      if (selectedZone && selectedZone !== 'ALL') {
        trafficUrl += `&zone=${encodeURIComponent(selectedZone)}`;
      }
      if (selectedCongestion && selectedCongestion !== 'ALL') {
        trafficUrl += `&congestion_level=${encodeURIComponent(selectedCongestion)}`;
      }
      if (selectedRoadId && selectedRoadId !== 'ALL') {
        trafficUrl += `&road_id=${selectedRoadId}`;
      }

      const [opsRes, trafRes] = await Promise.all([
        apiClient.get('/reports/summary'),
        apiClient.get(trafficUrl)
      ]);

      setOperationalReports(opsRes);
      setTrafficReports(trafRes);

      if (isManual) {
        showSuccess('System performance and telemetry reports updated', 'Reports Refreshed');
      }
    } catch (err) {
      console.error("Report fetch error:", err);
      showError(err.message || 'Failed to load system reports');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrafficTrends = async () => {
    setIsTrendLoading(true);
    try {
      let trendUrl = `/reports/traffic/trends?time_range=${trendTimeRange}`;
      if (trendRoadId && trendRoadId !== 'ALL') {
        trendUrl += `&road_id=${trendRoadId}`;
      }
      const res = await apiClient.get(trendUrl);
      setTrendData(res);
    } catch (err) {
      console.error("Trend fetch error:", err);
      showError(err.message || 'Failed to load traffic trends');
    } finally {
      setIsTrendLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    setIsRecLoading(true);
    try {
      const res = await apiClient.get('/reports/traffic/recommendations');
      setRecommendationList(res?.recommendations || []);
    } catch (err) {
      console.error("Recommendation fetch error:", err);
      showError(err.message || 'Failed to load AI traffic recommendations');
    } finally {
      setIsRecLoading(false);
    }
  };

  useEffect(() => {
    fetchAllReports();
  }, [selectedZone, selectedCongestion, selectedRoadId]);

  useEffect(() => {
    if (activeTab === 'trends') {
      fetchTrafficTrends();
    } else if (activeTab === 'recommendations') {
      fetchRecommendations();
    }
  }, [activeTab, trendRoadId, trendTimeRange]);

  const handleClearFilters = () => {
    setSelectedZone('ALL');
    setSelectedCongestion('ALL');
    setSelectedRoadId('ALL');
  };

  // CSV Report Export Handler
  const handleExportCSV = () => {
    if (!trafficReports?.road_reports || trafficReports.road_reports.length === 0) {
      showError('No report data available for export.');
      return;
    }

    const headers = ['Road Code', 'Road Name', 'Zone', 'Vehicle Volume', 'Avg Speed (km/h)', 'Congestion Level', 'Cars', 'Bikes', 'Buses', 'Trucks', 'Last Updated'];
    const rows = trafficReports.road_reports.map((r) => [
      r.road_code,
      `"${r.road_name}"`,
      `"${r.zone}"`,
      r.vehicle_count,
      r.average_speed,
      r.congestion_level,
      r.car_count,
      r.motorcycle_count,
      r.bus_count,
      r.truck_count,
      r.last_updated_at
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TrafficVision_AI_Telemetry_Report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess('Traffic telemetry report exported to CSV', 'Export Complete');
  };

  const summary = trafficReports?.summary || {};
  const congestionDist = summary.congestion_distribution || {};
  const trendSummary = trendData?.trend_summary || {};
  const timeSeries = trendData?.time_series || [];

  // Filter recommendations by category
  const filteredRecommendations = recommendationList.filter((rec) => {
    if (recCategoryFilter === 'ALL') return true;
    return rec.recommendation_type === recCategoryFilter;
  });

  return (
    <DashboardLayout role="Admin">
      <div className="space-y-6 animate-fade-in w-full">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
              <FaChartBar className="text-teal-400 text-xl" />
              <span>AI Traffic Analytics & System Reports</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Enterprise Control Center: Comprehensive traffic volume, speed analytics, vehicle class distributions, trends, and AI-driven traffic advisories.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={() => { fetchAllReports(true); if(activeTab==='trends') fetchTrafficTrends(); if(activeTab==='recommendations') fetchRecommendations(); }} className="space-x-1.5">
              <FaSync className={(isLoading || isTrendLoading || isRecLoading) ? 'animate-spin' : ''} />
              <span>Refresh Metrics</span>
            </Button>
            <Button size="sm" onClick={handleExportCSV} className="space-x-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold">
              <FaFileDownload />
              <span>Export CSV Report</span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation Switcher */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center space-x-2 transition-all ${
              activeTab === 'reports'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FaChartBar />
            <span>Traffic Telemetry Reports</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center space-x-2 transition-all ${
              activeTab === 'trends'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FaChartLine />
            <span>Traffic Trend Analysis</span>
          </button>

          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center space-x-2 transition-all ${
              activeTab === 'recommendations'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FaLightbulb className="text-amber-400" />
            <span>AI Traffic Recommendations</span>
          </button>
        </div>

        {/* Data Source Notice Banner */}
        <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl text-xs font-mono">
          <div className="flex items-center space-x-2 text-slate-300">
            <FaDatabase className="text-teal-400 text-sm" />
            <span><strong className="text-teal-400">DATA SOURCE:</strong> {trafficReports?.data_source || 'AI Traffic Telemetry / Supabase Cloud PostgreSQL'}</span>
          </div>
          <span className="text-[10px] text-slate-400 hidden md:inline-block">100% Real Database Analytics • Zero Mock Values</span>
        </div>

        {/* TAB 1: TELEMETRY REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6 animate-fade-in">
            {/* Executive Summary Metrics Cards */}
            {isLoading && !trafficReports ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SkeletonMetric />
                <SkeletonMetric />
                <SkeletonMetric />
                <SkeletonMetric />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="hover:border-teal-500/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Vehicle Volume</p>
                      <h3 className="text-3xl font-extrabold text-teal-400 font-mono mt-1">
                        {summary.total_vehicle_volume ?? 0} <span className="text-xs font-normal text-slate-400">veh</span>
                      </h3>
                      <p className="text-[11px] text-teal-400 mt-1 font-medium">Across Monitored Corridors</p>
                    </div>
                    <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl">
                      <FaCar className="text-2xl" />
                    </div>
                  </div>
                </Card>

                <Card className="hover:border-sky-500/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Average Network Speed</p>
                      <h3 className="text-3xl font-extrabold text-sky-400 font-mono mt-1">
                        {summary.average_network_speed ?? 0} <span className="text-xs font-normal text-slate-400">km/h</span>
                      </h3>
                      <p className="text-[11px] text-sky-400 mt-1 font-medium">Min: {summary.min_speed} km/h • Max: {summary.max_speed} km/h</p>
                    </div>
                    <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                      <FaTachometerAlt className="text-2xl" />
                    </div>
                  </div>
                </Card>

                <Card className="hover:border-emerald-500/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Duty Roster</p>
                      <h3 className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">
                        {operationalReports?.summary?.active_operators ?? 0} / {operationalReports?.summary?.total_operators ?? 0}
                      </h3>
                      <p className="text-[11px] text-emerald-400 mt-1 font-medium">Active Personnel On Duty</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                      <FaUserTie className="text-2xl" />
                    </div>
                  </div>
                </Card>

                <Card className="hover:border-amber-500/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Coverage Rate</p>
                      <h3 className="text-3xl font-extrabold text-amber-400 font-mono mt-1">
                        {operationalReports?.summary?.coverage_percentage ?? 0}%
                      </h3>
                      <p className="text-[11px] text-amber-400 mt-1 font-medium">Assigned Corridors Ratio</p>
                    </div>
                    <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                      <FaRoad className="text-2xl" />
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ROAD-WISE TELEMETRY REPORT TABLE */}
            <Card title="Corridor Performance & Telemetry Report" subtitle="Road-level vehicle volume, speed metrics, vehicle composition splits, and congestion status">
              {isLoading ? (
                <SkeletonTable rows={8} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-[11px] uppercase bg-slate-900/90 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Road Code</th>
                        <th className="py-3 px-4">Corridor Name</th>
                        <th className="py-3 px-4">Zone</th>
                        <th className="py-3 px-4 text-right">Volume</th>
                        <th className="py-3 px-4 text-right">Avg Speed</th>
                        <th className="py-3 px-4">Detected Composition</th>
                        <th className="py-3 px-4 text-center">Congestion</th>
                        <th className="py-3 px-4 text-right">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {trafficReports?.road_reports?.map((r) => (
                        <tr key={r.road_id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-teal-400">{r.road_code}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-100 font-sans flex items-center space-x-2">
                            <FaRoad className="text-slate-500 shrink-0" />
                            <span>{r.road_name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 font-sans">{r.zone}</td>
                          <td className="py-3.5 px-4 text-teal-400 font-bold text-right">{r.vehicle_count} veh</td>
                          <td className="py-3.5 px-4 text-sky-400 font-bold text-right">{r.average_speed} km/h</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-sans">
                              <span className="flex items-center gap-1" title="Cars"><FaCar className="text-emerald-400" /> {r.car_count}</span>
                              <span className="flex items-center gap-1" title="Motorcycles"><FaMotorcycle className="text-amber-400" /> {r.motorcycle_count}</span>
                              <span className="flex items-center gap-1" title="Buses"><FaBus className="text-sky-400" /> {r.bus_count}</span>
                              <span className="flex items-center gap-1" title="Trucks"><FaTruck className="text-purple-400" /> {r.truck_count}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center font-sans">
                            <StatusBadge 
                              status={r.congestion_level} 
                              type={r.congestion_level === 'HIGH' || r.congestion_level === 'CRITICAL' ? 'red' : r.congestion_level === 'MODERATE' ? 'amber' : 'green'} 
                            />
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                            {new Date(r.last_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 2: TRAFFIC TREND ANALYSIS */}
        {activeTab === 'trends' && (
          <div className="space-y-6 animate-fade-in">
            {/* Trend Filter Bar */}
            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                <FaChartLine className="text-teal-400" />
                <span>TREND SELECTION:</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={trendRoadId}
                  onChange={(e) => setTrendRoadId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-teal-500"
                >
                  <option value="ALL">All Monitored Corridors</option>
                  {trafficReports?.road_reports?.map((r) => (
                    <option key={r.road_id} value={r.road_id}>
                      {r.road_code} - {r.road_name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                  {['1h', '6h', '24h', '7d'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setTrendTimeRange(range)}
                      className={`px-3 py-1 rounded-md transition-all ${
                        trendTimeRange === range
                          ? 'bg-teal-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Dynamic Analytical Trend Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 border-l-4 border-l-teal-500">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400">VEHICLE VOLUME TREND</span>
                  <FaCar className="text-teal-400 text-lg" />
                </div>
                <p className="text-xs text-slate-200 mt-2 font-sans font-medium leading-relaxed">
                  {trendSummary.volume_summary || 'Calculating volume changes...'}
                </p>
              </Card>

              <Card className="p-4 border-l-4 border-l-sky-500">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400">SPEED DYNAMICS</span>
                  <span className="bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded text-[10px] font-bold">
                    {trendSummary.speed_direction?.toUpperCase() || 'STABLE'}
                  </span>
                </div>
                <p className="text-xs text-slate-200 mt-2 font-sans font-medium leading-relaxed">
                  {trendSummary.speed_summary || 'Analyzing speed velocity...'}
                </p>
              </Card>

              <Card className="p-4 border-l-4 border-l-amber-500">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400">CONGESTION TRANSITION</span>
                  <FaExclamationTriangle className="text-amber-400 text-lg" />
                </div>
                <p className="text-xs text-slate-200 mt-2 font-sans font-medium leading-relaxed">
                  {trendSummary.congestion_summary || 'Evaluating severity shifts...'}
                </p>
              </Card>
            </div>

            {/* Time-Series Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Vehicle Volume Trend Over Time" subtitle="Chronological vehicle volume progression from database telemetry">
                <div className="h-72 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeries}>
                      <defs>
                        <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time_label" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="vehicle_count" name="Vehicle Volume" stroke="#14b8a6" fillOpacity={1} fill="url(#colorVol)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Average Speed Velocity Trend" subtitle="Network speed progression over time">
                <div className="h-72 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time_label" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Line type="monotone" dataKey="average_speed" name="Average Speed" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3, fill: '#38bdf8' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 3: AI TRAFFIC RECOMMENDATIONS */}
        {activeTab === 'recommendations' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Category Filter Bar */}
            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                <FaLightbulb className="text-amber-400 text-sm" />
                <span>AI ADVISORY CATEGORY:</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                {[
                  { label: 'All Advisories', value: 'ALL' },
                  { label: 'Congestion Warnings', value: 'CONGESTION_WARNING' },
                  { label: 'High-Risk Corridors', value: 'HIGH_RISK_CORRIDOR' },
                  { label: 'Speed Reductions', value: 'SPEED_REDUCTION' },
                  { label: 'Route Alternatives', value: 'ALTERNATIVE_ROUTE_SUGGESTION' },
                  { label: 'Stable Traffic', value: 'STABLE_TRAFFIC' }
                ].map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setRecCategoryFilter(cat.value)}
                    className={`px-3 py-1.5 rounded-lg border transition-all ${
                      recCategoryFilter === cat.value
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recommendations Grid */}
            {isRecLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonMetric />
                <SkeletonMetric />
              </div>
            ) : filteredRecommendations.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-xl border border-slate-800 text-slate-400 text-xs font-mono">
                No active traffic recommendations matching the selected advisory filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRecommendations.map((rec) => (
                  <div 
                    key={rec.id} 
                    className={`glass-panel p-5 rounded-2xl border transition-all ${
                      rec.severity === 'CRITICAL' ? 'border-rose-500/50 bg-rose-950/10' :
                      rec.severity === 'HIGH' ? 'border-orange-500/50 bg-orange-950/10' :
                      rec.severity === 'MODERATE' ? 'border-amber-500/40 bg-amber-950/10' :
                      'border-emerald-500/30 bg-slate-900/80'
                    }`}
                  >
                    {/* Header Badge */}
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                          {rec.road_code}
                        </span>
                        <span className="text-xs font-bold text-slate-100">{rec.road_name}</span>
                      </div>

                      <StatusBadge status={rec.severity} type={rec.severity === 'CRITICAL' || rec.severity === 'HIGH' ? 'red' : rec.severity === 'MODERATE' ? 'amber' : 'green'} />
                    </div>

                    {/* Recommendation Message */}
                    <p className="text-xs font-semibold text-slate-100 leading-snug mb-2 flex items-start gap-2">
                      <FaLightbulb className="text-amber-400 shrink-0 mt-0.5" />
                      <span>{rec.message}</span>
                    </p>

                    {/* Explainable Rationale */}
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 font-sans mb-3">
                      <strong className="text-amber-400 font-mono block text-[10px] uppercase mb-1">EXPLAINABLE DATABASE RATIONALE</strong>
                      {rec.explainable_rationale}
                    </div>

                    {/* Supporting Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 mb-4">
                      <div>
                        <span className="text-slate-500 block">Volume</span>
                        <span className="text-teal-400 font-bold">{rec.supporting_metrics?.vehicle_count} veh</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Avg Speed</span>
                        <span className="text-sky-400 font-bold">{rec.supporting_metrics?.average_speed} km/h</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Congestion</span>
                        <span className="text-amber-400 font-bold">{rec.supporting_metrics?.congestion_level}</span>
                      </div>
                    </div>

                    {/* GIS Map Direct Action Button */}
                    <Link
                      to={`/public/map?road_id=${rec.road_id}`}
                      className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
                    >
                      <span>Inspect Corridor on GIS Map</span>
                      <FaExternalLinkAlt className="text-[10px]" />
                    </Link>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
