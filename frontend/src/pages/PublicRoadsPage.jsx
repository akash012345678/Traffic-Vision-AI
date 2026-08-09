import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaRoad, FaSearch, FaFilter, FaTimes, FaCar, FaMotorcycle, 
  FaBus, FaTruck, FaTachometerAlt, FaMapMarkerAlt, FaExclamationTriangle, FaTimesCircle 
} from 'react-icons/fa';
import { PublicLayout } from '../layouts/PublicLayout';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { SkeletonCard } from '../components/ui/Skeleton';
import apiClient from '../services/api';

export const PublicRoadsPage = () => {
  const [roads, setRoads] = useState([]);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [roadDetail, setRoadDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [congestionFilter, setCongestionFilter] = useState('ALL');

  useEffect(() => {
    const fetchRoads = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get('/public/roads');
        const list = Array.isArray(res) ? res : [];
        setRoads(list);
        if (list.length > 0) {
          fetchRoadDetail(list[0].id);
        }
      } catch (err) {
        setError('Failed to load monitored road corridors.');
      } finally {
        setLoading(false);
      }
    };

    fetchRoads();
  }, []);

  const fetchRoadDetail = async (roadId) => {
    setDetailLoading(true);
    try {
      const res = await apiClient.get(`/public/roads/${roadId}`);
      setRoadDetail(res);
      setSelectedRoad(res);
    } catch (err) {
      console.warn("Could not fetch road detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const zones = useMemo(() => {
    const setZ = new Set(roads.map(r => r.zone).filter(Boolean));
    return Array.from(setZ);
  }, [roads]);

  const filteredRoads = useMemo(() => {
    return roads.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || r.road_name.toLowerCase().includes(q) || (r.road_code && r.road_code.toLowerCase().includes(q)) || r.zone.toLowerCase().includes(q);
      const matchesZone = zoneFilter === 'ALL' || r.zone === zoneFilter;
      const matchesCong = congestionFilter === 'ALL' || (r.congestion_level || '').toUpperCase() === congestionFilter.toUpperCase();
      return matchesSearch && matchesZone && matchesCong;
    });
  }, [roads, searchQuery, zoneFilter, congestionFilter]);

  const getCongestionType = (level) => {
    const lvl = (level || 'LOW').toUpperCase();
    if (lvl === 'LOW') return 'green';
    if (lvl === 'MODERATE') return 'amber';
    if (lvl === 'HIGH') return 'amber';
    return 'red';
  };

  return (
    <PublicLayout>
      <div className="space-y-6 animate-fade-in w-full">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
              <FaRoad className="text-teal-400 text-xl" />
              <span>Monitored Road Corridors</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Read-only public catalog of city traffic corridors, active vehicle counts, speeds, and live congestion statuses.
            </p>
          </div>
        </div>

        {/* Toolbar: Search & Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
              <input
                type="text"
                placeholder="Search road name, code, or zone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <FaTimes />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto text-xs">
              
              {/* Zone Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-medium">Zone:</span>
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="ALL">All Zones</option>
                  {zones.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>

              {/* Congestion Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-medium">Congestion:</span>
                <select
                  value={congestionFilter}
                  onChange={(e) => setCongestionFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="ALL">All Levels</option>
                  <option value="LOW">LOW</option>
                  <option value="MODERATE">MODERATE</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL / SEVERE</option>
                </select>
              </div>

            </div>

          </div>
        </Card>

        {/* Main Grid: Roads Cards + Read-Only Inspector Side Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Roads Grid */}
          <div className="lg:col-span-7 space-y-4">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredRoads.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3 glass-panel rounded-2xl border border-slate-800">
                <FaExclamationTriangle className="text-3xl text-slate-600 mx-auto" />
                <p className="text-sm font-semibold">No road corridors found matching current search or filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredRoads.map((r) => {
                  const isSelected = selectedRoad?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => fetchRoadDetail(r.id)}
                      className={`glass-panel p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-teal-500 bg-slate-900/90 shadow-lg shadow-teal-500/10'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-mono font-bold text-teal-400">{r.road_code}</span>
                        <StatusBadge status={r.congestion_level} type={getCongestionType(r.congestion_level)} />
                      </div>

                      <h3 className="text-sm font-bold text-slate-100 mb-1">{r.road_name}</h3>
                      <p className="text-[11px] text-slate-400 mb-3">{r.zone}</p>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Vehicles</span>
                          <span className="font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                            <FaCar className="text-slate-500 text-[10px]" /> {r.vehicle_count}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Avg Speed</span>
                          <span className="font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                            <FaTachometerAlt className="text-emerald-500/70 text-[10px]" /> {r.average_speed} km/h
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Read-Only Detail Inspection Panel */}
          <div className="lg:col-span-5">
            {detailLoading ? (
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : roadDetail ? (
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5 sticky top-24">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-teal-400">{roadDetail.road_code}</span>
                    <h2 className="text-xl font-bold text-slate-100 mt-0.5">{roadDetail.road_name}</h2>
                    <p className="text-xs text-slate-400">{roadDetail.zone}</p>
                  </div>
                  <StatusBadge status={roadDetail.congestion_level} type={getCongestionType(roadDetail.congestion_level)} />
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Current Vehicle Volume</span>
                    <span className="text-xl font-black text-slate-100 font-mono mt-1 block">
                      {roadDetail.vehicle_count} <span className="text-xs font-normal text-slate-400">veh</span>
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Estimated Speed</span>
                    <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
                      {roadDetail.average_speed} <span className="text-xs font-normal text-slate-400">km/h</span>
                    </span>
                  </div>

                </div>

                {/* Vehicle Class Breakdown */}
                <div className="space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Detected Vehicle Breakdown
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <FaCar className="text-emerald-400" /> Cars
                      </span>
                      <strong className="font-mono text-slate-100">{roadDetail.car_count || 0}</strong>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <FaMotorcycle className="text-amber-400" /> Motorcycles
                      </span>
                      <strong className="font-mono text-slate-100">{roadDetail.motorcycle_count || 0}</strong>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <FaBus className="text-blue-400" /> Buses
                      </span>
                      <strong className="font-mono text-slate-100">{roadDetail.bus_count || 0}</strong>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <FaTruck className="text-purple-400" /> Trucks
                      </span>
                      <strong className="font-mono text-slate-100">{roadDetail.truck_count || 0}</strong>
                    </div>
                  </div>
                </div>

                {/* Physical Specifications */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>Speed Limit:</span>
                    <strong className="text-slate-200">{roadDetail.speed_limit} km/h</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Corridor Lanes:</span>
                    <strong className="text-slate-200">{roadDetail.lanes} Lanes</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Segment Length:</span>
                    <strong className="text-slate-200">{roadDetail.length_km} km</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>GIS Coordinates:</span>
                    <strong className="text-teal-400">{roadDetail.latitude?.toFixed(4)}, {roadDetail.longitude?.toFixed(4)}</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800">
                    <span>Last Telemetry Sync:</span>
                    <strong className="text-emerald-400">
                      {roadDetail.last_updated_at ? new Date(roadDetail.last_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                    </strong>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs italic glass-panel rounded-2xl border border-slate-800">
                Select a road corridor to view real-time public telemetry details.
              </div>
            )}
          </div>

        </div>

      </div>
    </PublicLayout>
  );
};
