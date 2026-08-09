import React, { useState, useEffect } from 'react';
import { 
  FaMapMarkedAlt, FaRoad, FaTachometerAlt, FaCar, FaSync, FaExclamationTriangle, FaInfoCircle 
} from 'react-icons/fa';
import { PublicLayout } from '../layouts/PublicLayout';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import apiClient from '../services/api';

export const PublicMapPage = () => {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMapData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/public/map-data');
      const list = Array.isArray(res) ? res : [];
      setNodes(list);
      if (list.length > 0) {
        setSelectedNode(list[0]);
      }
    } catch (err) {
      setError('Failed to load interactive public traffic map data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 15000);
    return () => clearInterval(interval);
  }, []);

  const getNodeColor = (level) => {
    const lvl = (level || 'LOW').toUpperCase();
    if (lvl === 'LOW') return '#10b981'; // Emerald
    if (lvl === 'MODERATE') return '#f59e0b'; // Amber
    if (lvl === 'HIGH') return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

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
              <FaMapMarkedAlt className="text-teal-400 text-xl" />
              <span>Interactive City Traffic Map</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Live spatial map displaying road network nodes, GPS coordinates, real-time speeds, and congestion density.
            </p>
          </div>

          <button
            onClick={fetchMapData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-2 transition-colors shrink-0"
          >
            <FaSync className={loading ? 'animate-spin text-teal-400' : 'text-slate-400'} />
            <span>Refresh Map Data</span>
          </button>
        </div>

        {/* Map Container & Inspection Side Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Vector GIS Canvas */}
          <div className="lg:col-span-8 glass-panel rounded-2xl border border-slate-800 p-6 flex flex-col justify-between min-h-[480px] relative overflow-hidden">
            
            {/* Map Canvas Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

            {/* Title / Legend */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <span className="text-xs font-mono text-teal-400 font-bold flex items-center gap-1.5">
                <FaInfoCircle /> METROPOLITAN CORRIDOR NETWORK
              </span>

              {/* Status Legend */}
              <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Low</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Moderate</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> High</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> Critical</span>
              </div>
            </div>

            {/* Interactive Nodes Area */}
            {loading && nodes.length === 0 ? (
              <div className="py-24 text-center text-slate-500 text-xs">
                Loading city corridor GPS coordinates...
              </div>
            ) : error ? (
              <div className="py-24 text-center text-slate-400 space-y-2">
                <FaExclamationTriangle className="text-3xl text-rose-500 mx-auto" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            ) : (
              <div className="relative z-10 my-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {nodes.map((node) => {
                  const color = getNodeColor(node.congestion_level);
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-900 border-teal-500 shadow-lg shadow-teal-500/20 scale-[1.02]'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-slate-200">{node.road_code}</span>
                        <span 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
                        />
                      </div>

                      <h4 className="text-xs font-bold text-slate-100 truncate mb-1">{node.road_name}</h4>
                      <p className="text-[10px] text-slate-400 truncate mb-2">{node.zone}</p>

                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                        <span>{node.vehicle_count} veh</span>
                        <span className="text-emerald-400 font-bold">{node.average_speed} km/h</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer Notice */}
            <div className="relative z-10 text-[10px] font-mono text-slate-500 border-t border-slate-800/80 pt-3 flex justify-between">
              <span>GIS MAP NODES: {nodes.length} ACTIVE CORRIDORS</span>
              <span>CLICK ANY NODE TO INSPECT TELEMETRY</span>
            </div>

          </div>

          {/* Right: Selected Node Details */}
          <div className="lg:col-span-4">
            {selectedNode ? (
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 sticky top-24">
                
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-teal-400">{selectedNode.road_code}</span>
                    <h3 className="text-lg font-bold text-slate-100 mt-0.5">{selectedNode.road_name}</h3>
                    <p className="text-xs text-slate-400">{selectedNode.zone}</p>
                  </div>
                  <StatusBadge status={selectedNode.congestion_level} type={getCongestionType(selectedNode.congestion_level)} />
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FaCar className="text-teal-400" /> Active Vehicles
                    </span>
                    <strong className="font-mono text-slate-100 text-sm">{selectedNode.vehicle_count} veh</strong>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FaTachometerAlt className="text-emerald-400" /> Live Speed
                    </span>
                    <strong className="font-mono text-emerald-400 text-sm">{selectedNode.average_speed} km/h</strong>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px] text-slate-400">
                    <div className="flex justify-between">
                      <span>Latitude:</span>
                      <strong className="text-slate-200">{selectedNode.latitude?.toFixed(4)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Longitude:</span>
                      <strong className="text-slate-200">{selectedNode.longitude?.toFixed(4)}</strong>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs italic glass-panel rounded-2xl border border-slate-800">
                Click a corridor node on the map to inspect live spatial telemetry.
              </div>
            )}
          </div>

        </div>

      </div>
    </PublicLayout>
  );
};
