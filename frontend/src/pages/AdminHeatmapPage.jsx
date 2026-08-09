import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaFire, FaRoad, FaTachometerAlt, FaSync, FaExclamationTriangle, 
  FaInfoCircle, FaSun, FaMoon, FaGlobeAmericas, FaLayerGroup, FaDotCircle, FaShieldAlt
} from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { DashboardLayout } from '../layouts/DashboardLayout';
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

// Custom Leaflet DivIcon generator for 3D traffic markers
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
    ? 'border-2 border-white ring-4 ring-amber-400/80 scale-125 z-50' 
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

export const AdminHeatmapPage = ({ role = 'Admin' }) => {
  const [nodes, setNodes] = useState([]);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [viewMode, setViewMode] = useState('combined'); // 'combined', 'heatmap', 'markers'
  const [selectedNode, setSelectedNode] = useState(null);
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]);
  const [mapStyle, setMapStyle] = useState('voyager'); // 'voyager', 'osm', 'dark'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHeatmapData = async () => {
    try {
      const [roadsRes, heatRes] = await Promise.all([
        apiClient.get('/public/roads'),
        apiClient.get('/public/traffic/heatmap')
      ]);
      const list = Array.isArray(roadsRes) ? roadsRes : [];
      setNodes(list);
      setHeatmapPoints(Array.isArray(heatRes) ? heatRes : []);

      if (list.length > 0) {
        setSelectedNode((prev) => {
          if (!prev) {
            setMapCenter([list[0].latitude, list[0].longitude]);
            return list[0];
          }
          const updated = list.find((item) => item.id === prev.id);
          return updated || prev;
        });
      }
    } catch (err) {
      console.error("Admin heatmap fetch error:", err);
      setError("Failed to fetch Control Center traffic heatmap telemetry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmapData();
    const interval = setInterval(fetchHeatmapData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectRoad = (node) => {
    if (node && node.latitude && node.longitude) {
      setSelectedNode(node);
      setMapCenter([node.latitude, node.longitude]);
    }
  };

  // Map Tile Layer URLs
  const tileUrls = {
    voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  };

  const tileAttributions = {
    voyager: '&copy; OpenStreetMap &copy; CARTO',
    osm: '&copy; OpenStreetMap',
    dark: '&copy; OpenStreetMap &copy; CARTO'
  };

  const computedCenter = useMemo(() => {
    if (selectedNode && selectedNode.latitude && selectedNode.longitude) {
      return [selectedNode.latitude, selectedNode.longitude];
    }
    if (nodes.length > 0 && nodes[0].latitude && nodes[0].longitude) {
      return [nodes[0].latitude, nodes[0].longitude];
    }
    return [40.7128, -74.0060];
  }, [selectedNode, nodes]);

  // Compute summary stats from real heatmap points
  const totalHeatNodes = heatmapPoints.length;
  const highHeatNodes = heatmapPoints.filter(p => p.congestion_level === 'HIGH' || p.congestion_level === 'CRITICAL' || p.congestion_level === 'SEVERE').length;

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6 w-full animate-fade-in">
        
        {/* Control Room Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-panel p-4 rounded-xl border border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
              <FaFire className="text-amber-400 text-xl" />
              <span>Control Center Traffic Heatmap Console</span>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
                REAL GIS DENSITY
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Geographic traffic density heatmap overlays calculated in real-time from AI vehicle classification telemetry.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={fetchHeatmapData}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-2 transition-colors"
            >
              <FaSync className={loading ? 'animate-spin text-amber-400' : 'text-slate-400'} />
              <span>Sync Heatmap Data</span>
            </button>
          </div>
        </div>

        {/* Heatmap Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-amber-500">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Monitored Heat Nodes</p>
            <h3 className="text-2xl font-extrabold text-slate-100 font-mono mt-1">{totalHeatNodes}</h3>
            <p className="text-[10px] text-amber-400 mt-1 font-medium">100% Real DB Coordinates</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-rose-500">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">High Density Zones</p>
            <h3 className="text-2xl font-extrabold text-rose-400 font-mono mt-1">{highHeatNodes}</h3>
            <p className="text-[10px] text-rose-400 mt-1 font-medium">High / Critical Congestion</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-teal-500">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Average Heat Intensity</p>
            <h3 className="text-2xl font-extrabold text-teal-400 font-mono mt-1">
              {totalHeatNodes > 0 ? Math.round((heatmapPoints.reduce((acc, p) => acc + (p.intensity || 0.5), 0) / totalHeatNodes) * 100) : 0}%
            </h3>
            <p className="text-[10px] text-teal-400 mt-1 font-medium">PCE Density Weighted</p>
          </Card>

          <Card className="p-4 border-l-4 border-l-sky-500">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">GIS Layer Engine</p>
            <h3 className="text-2xl font-extrabold text-sky-400 font-mono mt-1">OpenStreetMap</h3>
            <p className="text-[10px] text-sky-400 mt-1 font-medium">CartoDB Voyager Bright Tiles</p>
          </Card>
        </div>

        {/* GIS Heatmap Canvas Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Leaflet Map */}
          <div className="lg:col-span-8 glass-panel rounded-2xl border border-slate-800 p-4 flex flex-col justify-between min-h-[580px] relative overflow-hidden">
            
            {/* Header Controls */}
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-3">
              <span className="text-xs font-mono text-amber-400 font-bold flex items-center gap-1.5">
                <FaShieldAlt /> CONTROL CENTER GIS HEATMAP OVERLAY
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Overlay Mode Selector */}
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
                  <button
                    onClick={() => setViewMode('combined')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                      viewMode === 'combined'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FaLayerGroup className="text-xs" />
                    <span>Combined</span>
                  </button>

                  <button
                    onClick={() => setViewMode('heatmap')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                      viewMode === 'heatmap'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FaFire className="text-xs" />
                    <span>Heatmap</span>
                  </button>

                  <button
                    onClick={() => setViewMode('markers')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                      viewMode === 'markers'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FaDotCircle className="text-xs" />
                    <span>Markers</span>
                  </button>
                </div>

                {/* Map Style Selector */}
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
                  <button
                    onClick={() => setMapStyle('voyager')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                      mapStyle === 'voyager' ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <FaSun className="text-xs" />
                    <span>Voyager</span>
                  </button>
                  <button
                    onClick={() => setMapStyle('osm')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                      mapStyle === 'osm' ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <FaGlobeAmericas className="text-xs" />
                    <span>OSM</span>
                  </button>
                  <button
                    onClick={() => setMapStyle('dark')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                      mapStyle === 'dark' ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <FaMoon className="text-xs" />
                    <span>Dark</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Leaflet Map Canvas */}
            <div className="relative z-0 w-full h-[480px] rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
              {loading && nodes.length === 0 ? (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400 text-xs font-mono">
                  Loading Control Center Traffic Heatmap GIS Canvas...
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

                  <TileLayer
                    key={mapStyle}
                    attribution={tileAttributions[mapStyle]}
                    url={tileUrls[mapStyle]}
                    maxZoom={19}
                  />

                  {/* Heatmap Circle Layers */}
                  {(viewMode === 'combined' || viewMode === 'heatmap') &&
                    heatmapPoints.map((hp) => {
                      if (!hp.latitude || !hp.longitude) return null;
                      const isSelected = selectedNode?.id === hp.road_id || selectedNode?.id === hp.id;
                      const color = hp.heat_color || '#f59e0b';
                      const radius = hp.radius_meters || 450;

                      return (
                        <Circle
                          key={`admin-heat-${hp.road_id}`}
                          center={[hp.latitude, hp.longitude]}
                          radius={radius}
                          pathOptions={{
                            color: color,
                            fillColor: color,
                            fillOpacity: isSelected ? 0.70 : 0.45,
                            weight: isSelected ? 4 : 2,
                            dashArray: isSelected ? '6, 6' : null
                          }}
                          eventHandlers={{
                            click: () => handleSelectRoad(hp)
                          }}
                        >
                          <Popup className="custom-leaflet-popup">
                            <div className="p-1 font-sans text-xs text-slate-900">
                              <span className="text-[10px] font-mono font-bold text-amber-600 uppercase flex items-center gap-1">
                                <FaFire className="text-amber-500" /> ADMIN HEATMAP INTENSITY
                              </span>
                              <strong className="block text-sm font-bold text-slate-900 leading-snug">{hp.road_name}</strong>
                              <div className="mt-1 pt-1 border-t border-slate-200 flex justify-between text-[11px] font-mono">
                                <span>Density Score: <strong>{Math.round((hp.intensity || 0.5) * 100)}%</strong></span>
                                <span>Volume: <strong>{hp.vehicle_count} veh</strong></span>
                              </div>
                            </div>
                          </Popup>
                        </Circle>
                      );
                    })
                  }

                  {/* 3D Road Markers */}
                  {(viewMode === 'combined' || viewMode === 'markers') &&
                    nodes.map((node) => {
                      if (!node.latitude || !node.longitude) return null;
                      const isSelected = selectedNode?.id === node.id;
                      const icon = createCongestionIcon(node.congestion_level, node.road_code, isSelected);

                      return (
                        <Marker
                          key={`admin-marker-${node.id}`}
                          position={[node.latitude, node.longitude]}
                          icon={icon}
                          eventHandlers={{
                            click: () => handleSelectRoad(node)
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
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })
                  }
                </MapContainer>
              )}
            </div>
          </div>

          {/* Right: Selected Corridor Telemetry Drawer */}
          <div className="lg:col-span-4 glass-panel rounded-2xl border border-slate-800 p-5 flex flex-col justify-between">
            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                      {selectedNode.road_code || 'RD-001'}
                    </span>
                    <h2 className="text-lg font-bold text-slate-100 mt-1">{selectedNode.road_name}</h2>
                    <p className="text-xs text-slate-400">{selectedNode.zone}</p>
                  </div>
                  <StatusBadge status={selectedNode.congestion_level} type={selectedNode.congestion_level === 'HIGH' || selectedNode.congestion_level === 'CRITICAL' ? 'red' : 'green'} />
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Vehicle Volume</span>
                    <span className="text-xl font-bold text-amber-400 mt-1 block">{selectedNode.vehicle_count} veh</span>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Average Speed</span>
                    <span className="text-xl font-bold text-emerald-400 mt-1 block">{selectedNode.average_speed} km/h</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">HEAT DENSITY ANALYSIS</span>
                  <div className="flex justify-between items-center text-slate-300 font-mono">
                    <span>Heat Intensity:</span>
                    <strong className="text-amber-400">
                      {selectedNode.congestion_level === 'CRITICAL' ? '100% (Maximum)' :
                       selectedNode.congestion_level === 'HIGH' ? '75% (Severe)' :
                       selectedNode.congestion_level === 'MODERATE' ? '50% (Moderate)' : '25% (Low Density)'}
                    </strong>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
                    <div 
                      className={`h-full rounded-full ${
                        selectedNode.congestion_level === 'CRITICAL' ? 'bg-rose-500 w-full' :
                        selectedNode.congestion_level === 'HIGH' ? 'bg-orange-500 w-3/4' :
                        selectedNode.congestion_level === 'MODERATE' ? 'bg-amber-500 w-1/2' : 'bg-emerald-500 w-1/4'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-12 text-xs">
                Select a heatmap corridor node on the map to inspect density metrics.
              </div>
            )}
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
};
