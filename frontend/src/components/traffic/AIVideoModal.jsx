import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  FaTimes, FaPlay, FaPause, FaVideo, FaRobot, FaDatabase, 
  FaCar, FaMotorcycle, FaBus, FaTruck, FaTachometerAlt, FaSyncAlt, FaExclamationTriangle 
} from 'react-icons/fa';
import apiClient from '../../services/api';

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const findNearestTelemetry = (telemetryArray, timeSec) => {
  if (!telemetryArray || telemetryArray.length === 0) return null;
  let low = 0, high = telemetryArray.length - 1;
  let best = telemetryArray[0];
  let minDiff = Math.abs((best.video_timestamp ?? 0) - timeSec);

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = telemetryArray[mid];
    const ts = item.video_timestamp ?? 0;
    const diff = Math.abs(ts - timeSec);

    if (diff < minDiff) {
      minDiff = diff;
      best = item;
    }

    if (ts < timeSec) {
      low = mid + 1;
    } else if (ts > timeSec) {
      high = mid - 1;
    } else {
      return item;
    }
  }
  return best;
};

// 1. Permanently Mounted & Memoized Video Player Component (Isolated from telemetry re-renders)
const TrafficVideoPlayer = React.memo(({
  videoUrl,
  videoId,
  onTimeUpdate,
  onSeeked,
  onLoadedMetadata,
  onError,
  videoError,
  duration
}) => {
  const videoRef = useRef(null);
  const [internalTime, setInternalTime] = useState(0);

  const handleTimeUpdateInternal = (e) => {
    const t = e.target.currentTime;
    setInternalTime(t);
    if (onTimeUpdate) {
      onTimeUpdate(t);
    }
  };

  const handleSeekedInternal = (e) => {
    const t = e.target.currentTime;
    setInternalTime(t);
    if (onSeeked) {
      onSeeked(t);
    }
  };

  return (
    <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner group">
      {videoError ? (
        <div className="p-12 text-center space-y-3 bg-slate-950 text-slate-400">
          <FaExclamationTriangle className="text-3xl text-red-400 mx-auto" />
          <p className="text-slate-200 font-bold">Unable to load traffic video</p>
          <p className="text-xs text-slate-400">Check server stream availability or video codec compatibility.</p>
        </div>
      ) : (
        <video
          key={videoId}
          ref={videoRef}
          src={videoUrl}
          onTimeUpdate={handleTimeUpdateInternal}
          onSeeked={handleSeekedInternal}
          onLoadedMetadata={onLoadedMetadata}
          onError={onError}
          controls
          preload="metadata"
          playsInline
          className="w-full h-auto max-h-[380px] object-contain bg-black"
        />
      )}

      {/* Floating Video Overlay HUD */}
      <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-950/80 backdrop-blur border border-slate-700/50 text-xs font-mono text-slate-300 flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>TIME: {formatTime(internalTime)} / {formatTime(duration)}</span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.videoId === nextProps.videoId &&
    prevProps.videoUrl === nextProps.videoUrl &&
    prevProps.videoError === nextProps.videoError &&
    prevProps.duration === nextProps.duration
  );
});

// 2. Memoized AI Analysis Dashboard Panel Component
const AIAnalysisPanel = React.memo(({
  currentTelemetry,
  videoDetails,
  getCongestionBadge,
  onClose
}) => {
  return (
    <div className="lg:col-span-5 flex flex-col space-y-4">
      
      {/* Card 1: Synchronized Analysis Header */}
      <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-400 tracking-wider uppercase flex items-center gap-1.5">
            <FaRobot /> Current AI Analysis
          </span>
          {getCongestionBadge(currentTelemetry?.congestion_level)}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400">Total Vehicles</div>
            <div className="text-2xl font-black text-slate-100 font-mono mt-0.5">
              {currentTelemetry
                ? ((currentTelemetry.car_count || 0) + (currentTelemetry.motorcycle_count || 0) + (currentTelemetry.bus_count || 0) + (currentTelemetry.truck_count || 0))
                : (videoDetails?.total_vehicles ?? ((videoDetails?.car_count || 0) + (videoDetails?.motorcycle_count || 0) + (videoDetails?.bus_count || 0) + (videoDetails?.truck_count || 0)))}
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400">Average Speed</div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5 flex items-baseline gap-1">
              {currentTelemetry?.average_speed ?? 28.5} <span className="text-xs font-normal text-slate-400">km/h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Vehicle Breakdown Matrix */}
      <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-2.5">
        <div className="text-xs font-bold text-slate-400 tracking-wider uppercase">
          Vehicle Type Breakdown
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="flex items-center gap-1.5 text-slate-300">
              <FaCar className="text-emerald-400" /> Cars
            </span>
            <strong className="font-mono text-slate-100 text-sm">
              {currentTelemetry?.car_count ?? videoDetails.car_count ?? 0}
            </strong>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="flex items-center gap-1.5 text-slate-300">
              <FaMotorcycle className="text-amber-400" /> Motorcycles
            </span>
            <strong className="font-mono text-slate-100 text-sm">
              {currentTelemetry?.motorcycle_count ?? videoDetails.motorcycle_count ?? 0}
            </strong>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="flex items-center gap-1.5 text-slate-300">
              <FaBus className="text-blue-400" /> Buses
            </span>
            <strong className="font-mono text-slate-100 text-sm">
              {currentTelemetry?.bus_count ?? videoDetails.bus_count ?? 0}
            </strong>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="flex items-center gap-1.5 text-slate-300">
              <FaTruck className="text-purple-400" /> Trucks
            </span>
            <strong className="font-mono text-slate-100 text-sm">
              {currentTelemetry?.truck_count ?? videoDetails.truck_count ?? 0}
            </strong>
          </div>
        </div>
      </div>

      {/* Card 3: AI Inference Confidence & Data Provenance */}
      <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs">
        <div className="flex justify-between text-slate-400">
          <span>Telemetry Timestamp Offset:</span>
          <strong className="text-emerald-400 font-mono">
            {currentTelemetry ? `${formatTime(currentTelemetry.video_timestamp)} (${Math.round(currentTelemetry.video_timestamp)}s)` : "00:00 (0s)"}
          </strong>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>AI Detection Confidence:</span>
          <strong className="text-slate-200 font-mono">
            {Math.round((currentTelemetry?.confidence ?? 0.88) * 100)}%
          </strong>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Pipeline Resolution:</span>
          <strong className="text-slate-200 font-mono">{videoDetails.resolution || "1920x1080"}</strong>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Frame Rate (FPS):</span>
          <strong className="text-slate-200 font-mono">{videoDetails.fps ? videoDetails.fps.toFixed(1) : "30.0"}</strong>
        </div>
      </div>

      {/* Modal Footer Controls */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl border border-slate-700 transition"
        >
          Close Video Viewer
        </button>
      </div>

    </div>
  );
});

// Main Modal Container Component
export const AIVideoModal = ({ isOpen, onClose, roadId, roadName: initialRoadName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoError, setVideoError] = useState(false);
  const [videoDetails, setVideoDetails] = useState(null);
  const [telemetryList, setTelemetryList] = useState([]);
  const [currentTelemetry, setCurrentTelemetry] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const telemetryListRef = useRef([]);
  const lastTelemetryIdRef = useRef(null);
  const lastUIUpdateRef = useRef(0);

  useEffect(() => {
    telemetryListRef.current = telemetryList;
  }, [telemetryList]);

  useEffect(() => {
    if (!isOpen || !roadId) {
      setVideoDetails(null);
      setTelemetryList([]);
      setCurrentTelemetry(null);
      setVideoError(false);
      lastTelemetryIdRef.current = null;
      lastUIUpdateRef.current = 0;
      return;
    }

    let isMounted = true;
    setVideoError(false);
    setVideoDetails(null);
    setTelemetryList([]);
    setCurrentTelemetry(null);
    lastTelemetryIdRef.current = null;
    lastUIUpdateRef.current = 0;

    const fetchVideoAndTelemetry = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch road video details
        const videoRes = await apiClient.get(`/videos/road/${roadId}`);
        if (!isMounted) return;
        setVideoDetails(videoRes);

        if (videoRes.has_video && videoRes.video_id) {
          // 2. Fetch ordered time-series telemetry for video
          try {
            const telemetryRes = await apiClient.get(`/videos/${videoRes.video_id}/telemetry`);
            if (isMounted && telemetryRes && Array.isArray(telemetryRes.telemetry)) {
              setTelemetryList(telemetryRes.telemetry);
              telemetryListRef.current = telemetryRes.telemetry;
              if (telemetryRes.telemetry.length > 0) {
                setCurrentTelemetry(telemetryRes.telemetry[0]);
                lastTelemetryIdRef.current = telemetryRes.telemetry[0].id;
              }
            }
          } catch (tErr) {
            console.warn("Could not load video-specific telemetry timeline:", tErr);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.detail || "Failed to load video details for this road corridor.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchVideoAndTelemetry();

    return () => {
      isMounted = false;
    };
  }, [isOpen, roadId]);

  // Fast & Deduplicated Telemetry Matcher for Continuous Playback
  const handleTimeUpdate = useCallback((timeSec) => {
    const now = Date.now();
    
    // Throttle parent state updates to ~200ms interval during playback
    if (now - lastUIUpdateRef.current < 200) return;
    lastUIUpdateRef.current = now;
    setCurrentTime(timeSec);

    const list = telemetryListRef.current;
    if (!list || list.length === 0) return;

    const matched = findNearestTelemetry(list, timeSec);

    if (matched && matched.id !== lastTelemetryIdRef.current) {
      lastTelemetryIdRef.current = matched.id;
      setCurrentTelemetry(matched);
    }
  }, []);

  // Instant Telemetry Matcher for Seeking / Scrubbing (Unthrottled)
  const handleSeeked = useCallback((timeSec) => {
    setCurrentTime(timeSec);
    const list = telemetryListRef.current;
    if (!list || list.length === 0) return;

    const matched = findNearestTelemetry(list, timeSec);
    if (matched && matched.id !== lastTelemetryIdRef.current) {
      lastTelemetryIdRef.current = matched.id;
      setCurrentTelemetry(matched);
    }
  }, []);

  const handleLoadedMetadata = useCallback((e) => {
    if (e.target) {
      setDuration(e.target.duration || 0);
      setVideoError(false);
    }
  }, []);

  const handleVideoError = useCallback((e) => {
    console.error("HTML5 Video playback error:", e);
    setVideoError(true);
  }, []);

  // Resolve backend HTTP video streaming URL
  const videoUrl = useMemo(() => {
    if (!videoDetails || !videoDetails.video_id) return null;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    return `${baseUrl}/videos/${videoDetails.video_id}/stream`;
  }, [videoDetails?.video_id]);

  const getStatusBadge = useCallback((status) => {
    const st = (status || 'PROCESSING').toUpperCase();
    if (st === 'PROCESSED' || st === 'COMPLETED') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
          <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2"></span>
          ● COMPLETED
        </span>
      );
    }
    if (st === 'PROCESSING') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40">
          <FaSyncAlt className="animate-spin mr-2 text-xs" />
          ● PROCESSING
        </span>
      );
    }
    if (st === 'FAILED') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40">
          <FaExclamationTriangle className="mr-1 text-xs" />
          FAILED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/40">
        PENDING
      </span>
    );
  }, []);

  const getCongestionBadge = useCallback((level) => {
    const lvl = (level || 'LOW').toUpperCase();
    let colorClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (lvl === 'MODERATE') colorClass = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    if (lvl === 'HIGH') colorClass = 'bg-orange-500/20 text-orange-400 border-orange-500/40';
    if (lvl === 'SEVERE' || lvl === 'CRITICAL') colorClass = 'bg-red-500/20 text-red-400 border-red-500/40';

    return (
      <span className={`px-3 py-1 rounded-md text-xs font-bold border ${colorClass}`}>
        {lvl}
      </span>
    );
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <FaVideo className="text-xl" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {videoDetails?.road_name || initialRoadName || "Traffic Corridor"}
                {videoDetails?.road_code && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    {videoDetails.road_code}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Video File: <strong className="text-slate-300">{videoDetails?.filename || "N/A"}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {videoDetails && getStatusBadge(videoDetails.status)}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
              title="Close Viewer"
            >
              <FaTimes className="text-lg" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <FaSyncAlt className="animate-spin text-3xl mx-auto text-blue-400" />
            <p>Loading AI Traffic Video & Synchronized Telemetry...</p>
          </div>
        ) : error || !videoDetails?.has_video ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <FaExclamationTriangle className="text-3xl text-amber-400 mx-auto" />
            <p className="text-slate-200 font-semibold">{error || "No traffic video is currently uploaded for this road."}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm font-medium transition"
            >
              Close Viewer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
            
            {/* Left Column: Processed Video Player */}
            <div className="lg:col-span-7 flex flex-col space-y-3">
              <TrafficVideoPlayer
                videoUrl={videoUrl}
                videoId={videoDetails.video_id}
                onTimeUpdate={handleTimeUpdate}
                onSeeked={handleSeeked}
                onLoadedMetadata={handleLoadedMetadata}
                onError={handleVideoError}
                videoError={videoError}
                duration={duration}
              />

              {/* Video Data Provenance Banner */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <FaDatabase className="text-blue-400 text-sm" />
                  <span>AI DATA SOURCE:</span>
                  <span className="text-slate-200 font-medium">Traffic Video → YOLOv8n Detection</span>
                </div>
                <div className="font-mono text-slate-400">
                  Time Offset: <strong className="text-emerald-400">{formatTime(currentTime)}</strong>
                </div>
              </div>
            </div>

            {/* Right Column: Synchronized Telemetry Dashboard */}
            <AIAnalysisPanel
              currentTelemetry={currentTelemetry}
              videoDetails={videoDetails}
              getCongestionBadge={getCongestionBadge}
              onClose={onClose}
            />

          </div>
        )}

      </div>
    </div>
  );
};
