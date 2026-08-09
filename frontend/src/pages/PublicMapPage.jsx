import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  FaMapMarkedAlt, FaRoad, FaTachometerAlt, FaCar, FaMotorcycle, FaBus, FaTruck, FaSync, FaExclamationTriangle, 
  FaInfoCircle, FaSun, FaMoon, FaGlobeAmericas 
} from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { PublicLayout } from '../layouts/PublicLayout';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import apiClient from '../services/api';

// Helper component to smoothly center map on selected corridor
const MapFlyTo = ({ center, zoom = 14 }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1] && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom, { duration: 1.2, animate: true });
    }
  }, [center, zoom, map]);
  return null;
};

// Custom Leaflet DivIcon generator for bright, vibrant 3D traffic markers
const createCongestionIcon = (level, code, isSelected) => {
  const lvl = (level || 'LOW').toString().toUpperCase();
  let bgGradient = 'linear-gradient(135deg, #10b981, #059669)'; // Emerald
  let shadowColor = 'rgba(16, 185, 129, 0.7)';

  if (lvl === 'MODERATE') {
    bgGradient = 'linear-gradient(135deg, #f59e0b, #d97706)'; // Amber
    shadowColor = 'rgba(245, 158, 11, 0.7)';
  } else if (lvl === 'HIGH') {
    bgGradient = 'linear-gradient(135deg, #f97316, #ea580c)'; // Orange
    shadowColor = 'rgba(249, 115, 22, 0.7)';
  } else if (lvl === 'CRITICAL' || lvl === 'SEVERE') {
    bgGradient = 'linear-gradient(135deg, #ef4444, #dc2626)'; // Red
    shadowColor = 'rgba(239, 68, 68, 0.9)';
  }

  const borderClass = isSelected 
    ? 'border-2 border-white ring-4 ring-teal-400/80 scale-125 z-50' 
    : 'border-2 border-white/90 shadow-md hover:scale-110';

  return L.divIcon({
    className: 'custom-traffic-marker',
    html: `
      <div style="
        background: ${bgGradient};
        box-shadow: 0 4px 14px ${shadowColor};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: 900;
        font-size: 11px;
        font-family: monospace;
        letter-spacing: -0.5px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-shadow: 0 1px 2px rgba(0,0,0,0.6);
      " class="${borderClass}">
        ${code || 'RD'}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

export const PublicMapPage = () => {
  const [searchParams] = useSearchParams();
  const targetRoadId = searchParams.get('road_id');

  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // NYC default center fallback
  const [mapStyle, setMapStyle] = useState('voyager'); // Default: 'voyager' (Bright & Crisp), 'osm', or 'dark'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMapData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/public/roads');
      const list = Array.isArray(res) ? res : [];
      setNodes(list);

      // Check if target road passed via URL
      if (targetRoadId && list.length > 0) {
        const found = list.find((item) => String(item.id) === String(targetRoadId));
        if (found) {
          setSelectedNode(found);
          setMapCenter([found.latitude, found.longitude]);
          return;
        }
      }

      // Auto-select first road if none selected yet
      if (list.length > 0) {
        setSelectedNode((prev) => {
          if (!prev) {
            setMapCenter([list[0].latitude, list[0].longitude]);
            return list[0];
          }
          // Update selected node telemetry if already selected
          const updated = list.find((item) => item.id === prev.id);
          return updated || prev;
        });
      }
    } catch (err) {
      console.error('Map data fetch error:', err);
      setError('Failed to fetch real-time geographic live map telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 15000);
    return () => clearInterval(interval);
  }, []);

  const [roadDetail, setRoadDetail] = useState(null);

  const handleSelectRoad = async (node) => {
    if (node && node.latitude && node.longitude) {
      setSelectedNode(node);
      setMapCenter([node.latitude, node.longitude]);
      try {
        const detail = await apiClient.get(`/public/roads/${node.id}`);
        setRoadDetail(detail);
      } catch (err) {
        console.warn("Could not fetch detailed telemetry for road:", err);
      }
    }
  };

  useEffect(() => {
    if (selectedNode && selectedNode.id) {
      apiClient.get(`/public/roads/${selectedNode.id}`)
        .then((detail) => setRoadDetail(detail))
        .catch(() => {});
    }
  }, [selectedNode?.id]);

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

  // Map Tile Layer URLs
  const tileUrls = {
    voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', // Bright & Crisp Voyager
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', // Standard OpenStreetMap Bright
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' // Dark Spatial
  };

  const tileAttributions = {
    voyager: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  };

  // Compute map center from all valid nodes if initial load
  const computedCenter = useMemo(() => {
    if (selectedNode && selectedNode.latitude && selectedNode.longitude) {
      return [selectedNode.latitude, selectedNode.longitude];
    }
    if (nodes.length > 0 && nodes[0].latitude && nodes[0].longitude) {
      return [nodes[0].latitude, nodes[0].longitude];
    }
    return [40.7128, -74.0060];
  }, [selectedNode, nodes]);

  return (
    <PublicLayout>
      <div className="space-y-6 animate-fade-in w-full">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
              <FaMapMarkedAlt className="text-teal-400 text-xl" />
              <span>Real Geographic Live Traffic Map</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Real-time spatial GIS map rendering actual road GPS coordinates, live vehicle speeds, and congestion density powered by OpenStreetMap.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={fetchMapData}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-2 transition-colors"
            >
              <FaSync className={loading ? 'animate-spin text-teal-400' : 'text-slate-400'} />
              <span>Refresh Live Telemetry</span>
            </button>
          </div>
        </div>

        {/* Map Container & Inspection Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Real Geographic Leaflet Map */}
          <div className="lg:col-span-8 glass-panel rounded-2xl border border-slate-800 p-4 flex flex-col justify-between min-h-[560px] relative overflow-hidden">
            
            {/* Title Bar, Map Style Switcher & Legend */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-3">
              <span className="text-xs font-mono text-teal-400 font-bold flex items-center gap-1.5">
                <FaInfoCircle /> METROPOLITAN SPATIAL GIS TILES
              </span>

              {/* Map Theme Toggle Buttons */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
                  <button
                    onClick={() => setMapStyle('voyager')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                      mapStyle === 'voyager'
                        ? 'bg-teal-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Bright Voyager Map"
                  >
                    <FaSun className="text-xs" />
                    <span>Bright Voyager</span>
                  </button>

                  <button
                    onClick={() => setMapStyle('osm')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                      mapStyle === 'osm'
                        ? 'bg-teal-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="OpenStreetMap Standard"
                  >
                    <FaGlobeAmericas className="text-xs" />
                    <span>OpenStreetMap</span>
                  </button>

                  <button
                    onClick={() => setMapStyle('dark')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                      mapStyle === 'dark'
                        ? 'bg-teal-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Dark Spatial Map"
                  >
                    <FaMoon className="text-xs" />
                    <span>Dark</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bright Leaflet Map Canvas */}
            <div className="relative z-0 w-full h-[450px] rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
              {loading && nodes.length === 0 ? (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400 text-xs font-mono">
                  Loading bright geographic GIS tiles and road markers...
                </div>
              ) : error ? (
                <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <FaExclamationTriangle className="text-3xl text-rose-500" />
                  <p className="text-sm font-semibold">{error}</p>
                </div>
              ) : (
                <MapContainer
                  center={computedCenter}
                  zoom={13}
                  scrollWheelZoom={true}
                  className="w-full h-full z-0"
                  style={{ background: '#f8fafc' }}
                >
                  <MapFlyTo center={mapCenter} zoom={14} />

                  {/* Bright-themed Basemap Tile Layer */}
                  <TileLayer
                    key={mapStyle}
                    attribution={tileAttributions[mapStyle]}
                    url={tileUrls[mapStyle]}
                    maxZoom={19}
                  />

                  {/* Geographic Markers for all monitored roads */}
                  {nodes.map((node) => {
                    if (!node.latitude || !node.longitude) return null;
                    const isSelected = selectedNode?.id === node.id;
                    const icon = createCongestionIcon(node.congestion_level, node.road_code, isSelected);

                    return (
                      <Marker
                        key={node.id}
                        position={[node.latitude, node.longitude]}
                        icon={icon}
                        eventHandlers={{
                          click: () => handleSelectRoad(node),
                        }}
                      >
                        <Popup className="custom-leaflet-popup">
                          <div className="p-1.5 font-sans text-xs text-slate-900">
                            <span className="text-[10px] font-mono font-bold text-teal-600 block">{node.road_code}</span>
                            <strong className="block text-sm font-bold text-slate-900 leading-snug">{node.road_name}</strong>
                            <span className="text-[11px] text-slate-600 block mb-2">{node.zone}</span>
                            <div className="pt-1.5 border-t border-slate-200 flex justify-between font-mono text-[11px] text-slate-800">
                              <span>Vehicles: <strong>{node.vehicle_count} veh</strong></span>
                              <span>Speed: <strong className="text-emerald-700">{node.average_speed} km/h</strong></span>
                            </div>
                            <div className="mt-2 pt-1 border-t border-slate-100 flex justify-between items-center">
                              <span className="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-white bg-slate-900">
                                {node.congestion_level}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {formatTimeSafely(node.last_updated_at)}
                              </span>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              )}
            </div>

            {/* Map Legend & Footer Info */}
            <div className="relative z-10 text-xs text-slate-300 border-t border-slate-800/80 pt-3 mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-3 text-[11px] font-mono bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 font-bold mr-1">LEGEND:</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 🟢 Low</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> 🟡 Moderate</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> 🟠 High</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span> 🔴 Critical</span>
              </div>

              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-3">
                <span>GIS NODES: <strong>{nodes.length} ACTIVE CORRIDORS</strong></span>
                <span>CLICK MARKER TO CENTER</span>
              </div>
            </div>

          </div>

          {/* Right: Selected Corridor Live Telemetry Panel */}
          <div className="lg:col-span-4">
            {selectedNode ? (
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 sticky top-24 shadow-xl">
                
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
                      <FaCar className="text-teal-400" /> Vehicle Volume
                    </span>
                    <strong className="font-mono text-slate-100 text-sm">{roadDetail?.vehicle_count ?? selectedNode.vehicle_count} veh</strong>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <FaTachometerAlt className="text-emerald-400" /> Live Average Speed
                    </span>
                    <strong className="font-mono text-emerald-400 text-sm">{roadDetail?.average_speed ?? selectedNode.average_speed} km/h</strong>
                  </div>

                  {/* Vehicle Class Breakdown */}
                  {roadDetail && (
                    <div className="space-y-2 text-xs pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Detected Vehicle Breakdown
                      </span>
                      
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                          <span className="flex items-center gap-1 text-slate-300">
                            <FaCar className="text-emerald-400" /> Cars
                          </span>
                          <strong className="text-slate-100">{roadDetail.car_count || 0}</strong>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                          <span className="flex items-center gap-1 text-slate-300">
                            <FaMotorcycle className="text-amber-400" /> Bikes
                          </span>
                          <strong className="text-slate-100">{roadDetail.motorcycle_count || 0}</strong>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                          <span className="flex items-center gap-1 text-slate-300">
                            <FaBus className="text-blue-400" /> Buses
                          </span>
                          <strong className="text-slate-100">{roadDetail.bus_count || 0}</strong>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                          <span className="flex items-center gap-1 text-slate-300">
                            <FaTruck className="text-purple-400" /> Trucks
                          </span>
                          <strong className="text-slate-100">{roadDetail.truck_count || 0}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Telemetry Snapshot Timeline */}
                  {roadDetail && Array.isArray(roadDetail.telemetry_history) && roadDetail.telemetry_history.length > 0 && (
                    <div className="space-y-1.5 text-xs pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Recent Telemetry History
                      </span>
                      <div className="overflow-x-auto rounded-lg border border-slate-800">
                        <table className="w-full text-left text-[10px] font-mono text-slate-300">
                          <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[9px]">
                            <tr>
                              <th className="py-1.5 px-2">Time</th>
                              <th className="py-1.5 px-2">Veh</th>
                              <th className="py-1.5 px-2">Speed</th>
                              <th className="py-1.5 px-2 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {roadDetail.telemetry_history.map((h, idx) => (
                              <tr key={h.id || idx} className="hover:bg-slate-900/40">
                                <td className="py-1 px-2 text-slate-400">
                                  {h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live'}
                                </td>
                                <td className="py-1 px-2 font-bold text-slate-200">{h.vehicle_count}</td>
                                <td className="py-1 px-2 text-emerald-400">{h.average_speed}</td>
                                <td className="py-1 px-2 text-right">
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                    h.congestion_level === 'LOW' ? 'bg-emerald-500/10 text-emerald-400' :
                                    h.congestion_level === 'MODERATE' ? 'bg-amber-500/10 text-amber-400' :
                                    'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {h.congestion_level}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px] text-slate-400">
                    <div className="flex justify-between">
                      <span>Latitude:</span>
                      <strong className="text-slate-200">{selectedNode.latitude?.toFixed(4)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Longitude:</span>
                      <strong className="text-slate-200">{selectedNode.longitude?.toFixed(4)}</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-800">
                      <span>Last Updated:</span>
                      <strong className="text-teal-400">{formatTimeSafely(roadDetail?.last_updated_at || selectedNode.last_updated_at)}</strong>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs italic glass-panel rounded-2xl border border-slate-800">
                Click a marker on the map to inspect live spatial telemetry.
              </div>
            )}
          </div>

        </div>

        {/* Section 7: Complementary 12-Road Roster Grid */}
        <Card 
          title="Monitored Corridor Network Roster" 
          subtitle="Complementary list of all 12 monitored corridors (Click any card to fly and center the map on its location)"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => handleSelectRoad(node)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-teal-500 shadow-lg shadow-teal-500/20 scale-[1.02]'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-teal-400">{node.road_code}</span>
                    <StatusBadge status={node.congestion_level} type={getCongestionType(node.congestion_level)} />
                  </div>

                  <h4 className="text-sm font-bold text-slate-100 truncate mb-1">{node.road_name}</h4>
                  <p className="text-[11px] text-slate-400 truncate mb-3">{node.zone}</p>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Vehicles</span>
                      <span className="font-bold text-slate-200">{node.vehicle_count} veh</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Speed</span>
                      <span className="font-bold text-emerald-400">{node.average_speed} km/h</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

      </div>
    </PublicLayout>
  );
};
