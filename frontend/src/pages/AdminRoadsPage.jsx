import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useToast } from '../contexts/ToastContext';
import apiClient from '../services/api';
import { AIVideoModal } from '../components/traffic/AIVideoModal';
import { 
  FaRoad, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaMapMarkerAlt, 
  FaSync, 
  FaTimes, 
  FaSearch, 
  FaFilter, 
  FaSort, 
  FaSortUp, 
  FaSortDown, 
  FaEye, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaTools, 
  FaBan, 
  FaChevronLeft, 
  FaChevronRight, 
  FaUserTie,
  FaCalendarAlt,
  FaFileDownload,
  FaArchive,
  FaUndo,
  FaTachometerAlt,
  FaCar,
  FaRuler,
  FaLayerGroup,
  FaVideo,
  FaPlay
} from 'react-icons/fa';

export const AdminRoadsPage = () => {
  const { showSuccess, showError } = useToast();
  const [roads, setRoads] = useState([]);
  const [operators, setOperators] = useState([]);
  const [zones, setZones] = useState([]);
  const [telemetryMap, setTelemetryMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Video viewer modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [selectedVideoRoadId, setSelectedVideoRoadId] = useState(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Sorting state
  const [sortField, setSortField] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [editingRoad, setEditingRoad] = useState(null);
  const [deletingRoad, setDeletingRoad] = useState(null);
  const [viewingRoad, setViewingRoad] = useState(null);
  const [viewingDetail, setViewingDetail] = useState(null);
  const [isLoadingView, setIsLoadingView] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    road_name: '',
    road_code: '',
    zone: 'Zone Alpha',
    latitude: 12.9716,
    longitude: 77.5946,
    length_km: 2.5,
    lanes: 4,
    speed_limit: 60,
    status: 'Active',
    assigned_operator_id: ''
  });

  // Fetch all road corridors, operators, and telemetry mapping
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [roadsRes, opsRes, zonesRes, telemetryRes] = await Promise.all([
        apiClient.get('/roads'),
        apiClient.get('/admin/operators').catch(() => []),
        apiClient.get('/admin/zones').catch(() => []),
        apiClient.get('/traffic/monitoring').catch(() => ({ items: [] }))
      ]);

      const roadList = Array.isArray(roadsRes) ? roadsRes : (roadsRes.items || []);
      setRoads(roadList);
      setOperators(Array.isArray(opsRes) ? opsRes : []);
      
      if (Array.isArray(zonesRes) && zonesRes.length > 0) {
        setZones(zonesRes.map(z => z.zone_name));
      } else {
        const uniqueZones = Array.from(new Set(roadList.map(r => r.zone).filter(Boolean)));
        setZones(uniqueZones.length ? uniqueZones : ['Zone Alpha', 'Zone Beta', 'Zone Gamma', 'Zone Delta']);
      }

      // Map live telemetry by road_id
      const items = telemetryRes.items || (Array.isArray(telemetryRes) ? telemetryRes : []);
      const map = {};
      items.forEach(t => {
        if (t.road_id) {
          map[t.road_id] = t;
        }
      });
      setTelemetryMap(map);

    } catch (err) {
      showError(err.message || 'Failed to fetch road management records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute summary statistics
  const stats = useMemo(() => {
    const total = roads.length;
    const active = roads.filter(r => (r.status || 'Active').toLowerCase() === 'active').length;
    const maintenance = roads.filter(r => (r.status || '').toLowerCase() === 'maintenance').length;
    const closed = roads.filter(r => (r.status || '').toLowerCase() === 'closed').length;
    const archived = roads.filter(r => (r.status || '').toLowerCase() === 'archived').length;
    return { total, active, maintenance, closed, archived };
  }, [roads]);

  // Filtered and Sorted roads list
  const filteredAndSortedRoads = useMemo(() => {
    let result = [...roads];

    // Search filter (road name or road code)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(r => 
        (r.road_name && r.road_name.toLowerCase().includes(query)) ||
        (r.road_code && r.road_code.toLowerCase().includes(query)) ||
        (r.zone && r.zone.toLowerCase().includes(query)) ||
        (r.assigned_operator_name && r.assigned_operator_name.toLowerCase().includes(query))
      );
    }

    // Zone filter
    if (selectedZone !== 'ALL') {
      result = result.filter(r => r.zone && r.zone.toLowerCase() === selectedZone.toLowerCase());
    }

    // Status filter
    if (selectedStatus !== 'ALL') {
      result = result.filter(r => r.status && r.status.toLowerCase() === selectedStatus.toLowerCase());
    }

    // Sorting
    result.sort((a, b) => {
      if (sortField === 'congestion') {
        const congestionRank = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1, OPTIMAL: 0 };
        const levelA = (telemetryMap[a.id]?.congestion_level || 'OPTIMAL').toUpperCase();
        const levelB = (telemetryMap[b.id]?.congestion_level || 'OPTIMAL').toUpperCase();
        let rankA = congestionRank[levelA] ?? 0;
        let rankB = congestionRank[levelB] ?? 0;

        if (rankA < rankB) return sortOrder === 'asc' ? -1 : 1;
        if (rankA > rankB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }

      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [roads, searchQuery, selectedZone, selectedStatus, sortField, sortOrder, telemetryMap]);

  // Paginated roads for current page
  const paginatedRoads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedRoads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedRoads, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedRoads.length / itemsPerPage) || 1;

  // Sorting Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return <FaSort className="text-slate-600 inline ml-1 text-xs" />;
    return sortOrder === 'asc' ? <FaSortUp className="text-teal-400 inline ml-1 text-xs" /> : <FaSortDown className="text-teal-400 inline ml-1 text-xs" />;
  };

  // Form Reset
  const resetForm = () => {
    setFormData({
      road_name: '',
      road_code: '',
      zone: zones[0] || 'Zone Alpha',
      latitude: 12.9716,
      longitude: 77.5946,
      length_km: 2.5,
      lanes: 4,
      speed_limit: 60,
      status: 'Active',
      assigned_operator_id: ''
    });
  };

  // Duplicate & Coordinate Validation Handler
  const validateForm = (isEdit = false, currentId = null) => {
    const nameTrim = formData.road_name.trim();
    const codeTrim = formData.road_code.trim();
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (!nameTrim) {
      showError('Road Name is required.', 'Validation Error');
      return false;
    }

    // Latitude & Longitude validation
    if (isNaN(lat) || lat < -90 || lat > 90) {
      showError('Latitude must be a valid number between -90 and 90.', 'Validation Error');
      return false;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      showError('Longitude must be a valid number between -180 and 180.', 'Validation Error');
      return false;
    }

    // Duplicate Road Name check
    const duplicateName = roads.find(r => 
      r.road_name.toLowerCase().trim() === nameTrim.toLowerCase() && 
      (!isEdit || r.id !== currentId)
    );
    if (duplicateName) {
      showError(`Road Name '${nameTrim}' already exists. Road names must be unique.`, 'Duplicate Name Error');
      return false;
    }

    // Duplicate Road Code check
    if (codeTrim) {
      const duplicateCode = roads.find(r => 
        r.road_code && r.road_code.toLowerCase().trim() === codeTrim.toLowerCase() && 
        (!isEdit || r.id !== currentId)
      );
      if (duplicateCode) {
        showError(`Road Code '${codeTrim}' already exists. Road codes must be unique.`, 'Duplicate Code Error');
        return false;
      }
    }

    return true;
  };

  // Create Road Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    try {
      const payload = {
        road_name: formData.road_name.trim(),
        road_code: formData.road_code.trim() || undefined,
        zone: formData.zone,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        length_km: parseFloat(formData.length_km) || 2.5,
        lanes: parseInt(formData.lanes, 10) || 4,
        speed_limit: parseInt(formData.speed_limit, 10) || 60,
        status: formData.status,
        assigned_operator_id: formData.assigned_operator_id ? parseInt(formData.assigned_operator_id, 10) : null
      };

      await apiClient.post('/roads', payload);
      showSuccess(`Road corridor '${payload.road_name}' created in Supabase`, 'Corridor Created');
      setIsAddModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      showError(err.message || 'Failed to create road corridor');
    }
  };

  // Open View Road Details Modal
  const handleOpenView = async (road) => {
    setViewingRoad(road);
    setViewingDetail(null);
    setIsViewModalOpen(true);
    setIsLoadingView(true);
    try {
      const detail = await apiClient.get(`/traffic/roads/${road.id}`);
      setViewingDetail(detail);
    } catch (err) {
      console.error('Failed to load detailed road telemetry:', err);
    } finally {
      setIsLoadingView(false);
    }
  };

  // Edit Road Open
  const handleOpenEdit = (road) => {
    setEditingRoad(road);
    setFormData({
      road_name: road.road_name || '',
      road_code: road.road_code || '',
      zone: road.zone || 'Zone Alpha',
      latitude: road.latitude || 12.9716,
      longitude: road.longitude || 77.5946,
      length_km: road.length_km || 2.5,
      lanes: road.lanes || 4,
      speed_limit: road.speed_limit || 60,
      status: road.status || 'Active',
      assigned_operator_id: road.assigned_operator_id ? String(road.assigned_operator_id) : ''
    });
    setIsEditModalOpen(true);
  };

  // Edit Road Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRoad || !validateForm(true, editingRoad.id)) return;

    try {
      const payload = {
        road_name: formData.road_name.trim(),
        road_code: formData.road_code.trim() || undefined,
        zone: formData.zone,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        length_km: parseFloat(formData.length_km) || 2.5,
        lanes: parseInt(formData.lanes, 10) || 4,
        speed_limit: parseInt(formData.speed_limit, 10) || 60,
        status: formData.status,
        assigned_operator_id: formData.assigned_operator_id ? parseInt(formData.assigned_operator_id, 10) : null
      };

      await apiClient.put(`/roads/${editingRoad.id}`, payload);
      showSuccess(`Road corridor #${editingRoad.id} updated in Supabase`, 'Corridor Updated');
      setIsEditModalOpen(false);
      setEditingRoad(null);
      resetForm();
      fetchData();
    } catch (err) {
      showError(err.message || 'Failed to update road corridor');
    }
  };

  // Archive 1-Click Toggle
  const handleArchiveRoad = async (roadObj) => {
    try {
      await apiClient.put(`/roads/${roadObj.id}/archive`);
      showSuccess(`Road '${roadObj.road_name}' archived successfully`, 'Corridor Archived');
      fetchData();
    } catch (err) {
      showError(err.message || 'Failed to archive road corridor');
    }
  };

  // Restore 1-Click Toggle
  const handleRestoreRoad = async (roadObj) => {
    try {
      await apiClient.put(`/roads/${roadObj.id}/restore`);
      showSuccess(`Road '${roadObj.road_name}' restored to Active status`, 'Corridor Restored');
      fetchData();
    } catch (err) {
      showError(err.message || 'Failed to restore road corridor');
    }
  };

  // Delete Road Handler
  const handleConfirmDelete = async () => {
    if (!deletingRoad) return;
    try {
      await apiClient.delete(`/roads/${deletingRoad.id}`);
      showSuccess(`Road '${deletingRoad.road_name}' deleted from Supabase`, 'Corridor Deleted');
      setIsDeleteModalOpen(false);
      setDeletingRoad(null);
      fetchData();
    } catch (err) {
      showError(err.message || 'Failed to delete road corridor');
    }
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!filteredAndSortedRoads.length) {
      showError('No road records available to export', 'Export Error');
      return;
    }

    const headers = ['ID', 'Road Name', 'Road Code', 'Zone', 'Operator', 'Status', 'Latitude', 'Longitude', 'Length (km)', 'Lanes', 'Speed Limit (km/h)', 'Created Date'];
    const rows = filteredAndSortedRoads.map(r => [
      r.id,
      `"${r.road_name.replace(/"/g, '""')}"`,
      `"${(r.road_code || '').replace(/"/g, '""')}"`,
      `"${(r.zone || '').replace(/"/g, '""')}"`,
      `"${(r.assigned_operator_name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${(r.status || 'Active').replace(/"/g, '""')}"`,
      r.latitude,
      r.longitude,
      r.length_km || 2.5,
      r.lanes || 4,
      r.speed_limit || 60,
      r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `roads_directory_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess(`Exported ${filteredAndSortedRoads.length} road records to CSV`, 'Export Complete');
  };

  const getStatusBadgeType = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'ACTIVE': return 'green';
      case 'MAINTENANCE': return 'amber';
      case 'CLOSED': return 'red';
      case 'ARCHIVED': return 'slate';
      default: return 'green';
    }
  };

  const getCongestionBadgeType = (level) => {
    switch ((level || '').toUpperCase()) {
      case 'LOW': return 'green';
      case 'MODERATE': return 'amber';
      case 'HIGH':
      case 'CRITICAL': return 'red';
      default: return 'green';
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="space-y-6 animate-fade-in w-full">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
              <FaRoad className="text-teal-400 text-xl" />
              <span>City Road Corridor Management</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Admin Console: Persisting all corridor specifications, GPS coordinates, lane counts, and duty operators in Supabase.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={fetchData} className="space-x-1.5">
              <FaSync className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh Records</span>
            </Button>

            <Button size="sm" onClick={handleExportCSV} className="space-x-1.5 bg-slate-900 border border-slate-800 text-slate-200 hover:text-white">
              <FaFileDownload />
              <span>Export CSV</span>
            </Button>

            <Button size="sm" onClick={() => { resetForm(); setIsAddModalOpen(true); }} className="space-x-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold">
              <FaPlus />
              <span>Create Road</span>
            </Button>
          </div>
        </div>

        {/* Metric Summary Widgets */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Roads</p>
              <h3 className="text-xl font-bold text-slate-100 mt-0.5 font-mono">{stats.total}</h3>
            </div>
            <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl">
              <FaRoad className="text-lg" />
            </div>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Corridors</p>
              <h3 className="text-xl font-bold text-emerald-400 mt-0.5 font-mono">{stats.active}</h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <FaCheckCircle className="text-lg" />
            </div>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Maintenance</p>
              <h3 className="text-xl font-bold text-amber-400 mt-0.5 font-mono">{stats.maintenance}</h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
              <FaTools className="text-lg" />
            </div>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Closed / Detour</p>
              <h3 className="text-xl font-bold text-rose-400 mt-0.5 font-mono">{stats.closed}</h3>
            </div>
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
              <FaBan className="text-lg" />
            </div>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between col-span-2 md:col-span-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Archived</p>
              <h3 className="text-xl font-bold text-slate-400 mt-0.5 font-mono">{stats.archived}</h3>
            </div>
            <div className="p-2.5 bg-slate-800 text-slate-400 rounded-xl">
              <FaArchive className="text-lg" />
            </div>
          </div>
        </div>

        {/* Search and Filters Toolbar */}
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            
            {/* Search Bar */}
            <div className="relative w-full lg:w-80">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
              <input
                type="text"
                placeholder="Search road name, code, zone, or operator..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <FaTimes />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              
              {/* Zone Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <FaFilter className="text-teal-400 text-[10px]" /> Zone:
                </span>
                <select
                  value={selectedZone}
                  onChange={(e) => { setSelectedZone(e.target.value); setCurrentPage(1); }}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="ALL">All Zones</option>
                  {zones.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              {/* Clear Filters */}
              {(searchQuery || selectedZone !== 'ALL' || selectedStatus !== 'ALL') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setSearchQuery(''); setSelectedZone('ALL'); setSelectedStatus('ALL'); setCurrentPage(1); }}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Clear Filters
                </Button>
              )}
            </div>

          </div>
        </Card>

        {/* Complete 9-Column Enterprise Road Table */}
        <Card title="City Road Corridors Directory" subtitle={`Displaying ${paginatedRoads.length} of ${filteredAndSortedRoads.length} total road records in Supabase`}>
          {isLoading ? (
            <SkeletonTable rows={8} />
          ) : filteredAndSortedRoads.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <FaRoad className="text-4xl text-slate-700 mx-auto" />
              <p className="text-sm font-medium text-slate-400">No road corridors found matching current search or filters.</p>
              <Button size="sm" variant="secondary" onClick={() => { setSearchQuery(''); setSelectedZone('ALL'); setSelectedStatus('ALL'); }}>
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase bg-slate-900/90 text-slate-400 border-b border-slate-800 select-none">
                  <tr>
                    <th className="py-3.5 px-4 cursor-pointer hover:text-teal-400" onClick={() => handleSort('road_name')}>
                      Road Name {renderSortIcon('road_name')}
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:text-teal-400" onClick={() => handleSort('road_code')}>
                      Road Code {renderSortIcon('road_code')}
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:text-teal-400" onClick={() => handleSort('zone')}>
                      Zone {renderSortIcon('zone')}
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:text-teal-400" onClick={() => handleSort('assigned_operator_name')}>
                      Operator {renderSortIcon('assigned_operator_name')}
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:text-teal-400" onClick={() => handleSort('status')}>
                      Status {renderSortIcon('status')}
                    </th>
                    <th className="py-3.5 px-4">Vehicle Count</th>
                    <th className="py-3.5 px-4">Average Speed</th>
                    <th className="py-3.5 px-4 cursor-pointer hover:text-teal-400" onClick={() => handleSort('congestion')}>
                      Congestion {renderSortIcon('congestion')}
                    </th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {paginatedRoads.map((r) => {
                    const telemetry = telemetryMap[r.id] || {};
                    const isArchived = (r.status || '').toLowerCase() === 'archived';

                    return (
                      <tr key={r.id} className="hover:bg-slate-900/50 transition-colors">
                        
                        {/* 1. Road Name Column */}
                        <td className="py-3.5 px-4 font-bold text-slate-100 flex items-center space-x-2.5">
                          <FaRoad className="text-teal-400 shrink-0" />
                          <div>
                            <span className="text-slate-100 block">{r.road_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              GPS: {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                            </span>
                          </div>
                        </td>

                        {/* 2. Road Code Column */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-teal-300">
                          {r.road_code || `RD-${String(r.id).padStart(3, '0')}`}
                        </td>


                        {/* 3. Zone Column */}
                        <td className="py-3.5 px-4 text-slate-300 font-medium">
                          <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px]">
                            {r.zone}
                          </span>
                        </td>

                        {/* 4. Operator Column */}
                        <td className="py-3.5 px-4 text-slate-300">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <FaUserTie className="text-teal-400 text-[10px]" />
                            {r.assigned_operator_name || 'Unassigned'}
                          </span>
                        </td>

                        {/* 5. Status Column */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={r.status || 'Active'} type={getStatusBadgeType(r.status)} />
                        </td>

                        {/* 6. Vehicle Count Column */}
                        <td className="py-3.5 px-4 font-mono text-teal-400 font-bold">
                          {telemetry.vehicle_count !== undefined ? `${telemetry.vehicle_count} veh` : '--'}
                        </td>

                        {/* 7. Average Speed Column */}
                        <td className="py-3.5 px-4 font-mono text-slate-200">
                          {telemetry.average_speed !== undefined ? `${telemetry.average_speed} km/h` : '--'}
                        </td>

                        {/* 8. Congestion Column */}
                        <td className="py-3.5 px-4">
                          {telemetry.congestion_level ? (
                            <StatusBadge status={telemetry.congestion_level} type={getCongestionBadgeType(telemetry.congestion_level)} />
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px]">Optimal</span>
                          )}
                        </td>

                        {/* 9. Actions Column */}
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          {/* View AI Video Button */}
                          <button
                            onClick={() => { setSelectedVideoRoadId(r.id); setIsVideoModalOpen(true); }}
                            className="p-1.5 rounded-lg bg-blue-900/40 border border-blue-500/40 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
                            title="▶ View AI Video Telemetry"
                          >
                            <FaPlay className="text-[10px]" />
                          </button>

                          {/* View Details */}
                          <button
                            onClick={() => handleOpenView(r)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-teal-400 hover:border-teal-500/40 transition-colors"
                            title="View Full Road Details"
                          >
                            <FaEye />
                          </button>

                          {/* Edit Road */}
                          <button
                            onClick={() => handleOpenEdit(r)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                            title="Edit Road Specifications"
                          >
                            <FaEdit />
                          </button>

                          {/* Archive / Restore 1-Click Toggle */}
                          {isArchived ? (
                            <button
                              onClick={() => handleRestoreRoad(r)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                              title="Restore Road to Active Status"
                            >
                              <FaUndo />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchiveRoad(r)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                              title="Archive Road"
                            >
                              <FaArchive />
                            </button>
                          )}

                          {/* Delete Road */}
                          <button
                            onClick={() => { setDeletingRoad(r); setIsDeleteModalOpen(true); }}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                            title="Delete Road"
                          >
                            <FaTrash />
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs">
              <span className="text-slate-400 font-mono">
                Showing page <strong className="text-slate-200">{currentPage}</strong> of <strong className="text-slate-200">{totalPages}</strong>
              </span>

              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-2.5 py-1 text-xs disabled:opacity-40"
                >
                  <FaChevronLeft className="mr-1" /> Prev
                </Button>

                <div className="flex items-center space-x-1 font-mono">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                        currentPage === pageNum
                          ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-2.5 py-1 text-xs disabled:opacity-40"
                >
                  Next <FaChevronRight className="ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* MODAL 1: CREATE ROAD MODAL */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-xl w-full glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <FaPlus className="text-teal-400" /> Create New Road Corridor
                </h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Road Name */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Road Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GST Road"
                      value={formData.road_name}
                      onChange={(e) => setFormData({ ...formData, road_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Road Code */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Road Code (Unique)</label>
                    <input
                      type="text"
                      placeholder="e.g. RD-025 (Optional)"
                      value={formData.road_code}
                      onChange={(e) => setFormData({ ...formData, road_code: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Zone */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">City Zone *</label>
                    <select
                      value={formData.zone}
                      onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      {zones.map(z => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Initial Status *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Closed">Closed</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>

                  {/* Latitude */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Latitude (-90 to 90) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Longitude */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Longitude (-180 to 180) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Length (km) */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Corridor Length (km)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formData.length_km}
                      onChange={(e) => setFormData({ ...formData, length_km: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Lanes */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Number of Lanes</label>
                    <input
                      type="number"
                      min="1"
                      max="16"
                      value={formData.lanes}
                      onChange={(e) => setFormData({ ...formData, lanes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Speed Limit */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Speed Limit (km/h)</label>
                    <input
                      type="number"
                      min="10"
                      max="150"
                      value={formData.speed_limit}
                      onChange={(e) => setFormData({ ...formData, speed_limit: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Assigned Operator */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Assigned Duty Operator</label>
                    <select
                      value={formData.assigned_operator_id}
                      onChange={(e) => setFormData({ ...formData, assigned_operator_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {operators.map(op => (
                        <option key={op.id} value={op.id}>{op.name} ({op.email})</option>
                      ))}
                    </select>
                  </div>

                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                  <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold">
                    Create Road Corridor
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: EDIT ROAD MODAL */}
        {isEditModalOpen && editingRoad && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-xl w-full glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <FaEdit className="text-cyan-400" /> Edit Road Corridor #{editingRoad.id}
                </h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Road Name */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Road Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.road_name}
                      onChange={(e) => setFormData({ ...formData, road_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Road Code */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Road Code</label>
                    <input
                      type="text"
                      value={formData.road_code}
                      onChange={(e) => setFormData({ ...formData, road_code: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Zone */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">City Zone *</label>
                    <select
                      value={formData.zone}
                      onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      {zones.map(z => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Status *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Closed">Closed</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>

                  {/* Latitude */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Latitude (-90 to 90) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Longitude */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Longitude (-180 to 180) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Length (km) */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Corridor Length (km)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formData.length_km}
                      onChange={(e) => setFormData({ ...formData, length_km: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Lanes */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Number of Lanes</label>
                    <input
                      type="number"
                      min="1"
                      max="16"
                      value={formData.lanes}
                      onChange={(e) => setFormData({ ...formData, lanes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Speed Limit */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Speed Limit (km/h)</label>
                    <input
                      type="number"
                      min="10"
                      max="150"
                      value={formData.speed_limit}
                      onChange={(e) => setFormData({ ...formData, speed_limit: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Assigned Operator */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Assigned Duty Operator</label>
                    <select
                      value={formData.assigned_operator_id}
                      onChange={(e) => setFormData({ ...formData, assigned_operator_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {operators.map(op => (
                        <option key={op.id} value={op.id}>{op.name} ({op.email})</option>
                      ))}
                    </select>
                  </div>

                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                  <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold">
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: VIEW ROAD DETAILS MODAL */}
        {isViewModalOpen && viewingRoad && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-2xl w-full glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <FaEye className="text-teal-400" /> Road Corridor Specifications #{viewingRoad.id}
                </h3>
                <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <FaTimes />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                
                {/* Basic Information */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FaRoad className="text-teal-400" /> Basic Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Road Name</span>
                      <span className="font-bold text-slate-100 text-sm block mt-0.5">{viewingRoad.road_name}</span>
                    </div>

                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Road Code</span>
                      <span className="font-mono font-bold text-teal-300 text-sm block mt-0.5">{viewingRoad.road_code || `RD-${String(viewingRoad.id).padStart(3, '0')}`}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 font-mono text-center mt-3">
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Length (km)</span>
                      <span className="font-bold text-slate-100 text-xs block mt-0.5">{viewingRoad.length_km || 2.5} km</span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Lanes</span>
                      <span className="font-bold text-teal-400 text-xs block mt-0.5">{viewingRoad.lanes || 4} lanes</span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Speed Limit</span>
                      <span className="font-bold text-purple-300 text-xs block mt-0.5">{viewingRoad.speed_limit || 60} km/h</span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Status</span>
                      <span className="font-bold text-emerald-400 text-xs block mt-0.5">{viewingRoad.status || 'Active'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1 mt-3">
                    <span className="text-slate-400 block text-[10px] uppercase">Zone & GPS Coordinates</span>
                    <p className="font-bold text-slate-200">{viewingRoad.zone}</p>
                    <p className="text-[11px] text-slate-400 font-mono">Latitude: {viewingRoad.latitude}, Longitude: {viewingRoad.longitude}</p>
                  </div>
                </div>

                {/* Assigned Operator */}
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Assigned Duty Operator</span>
                  <p className="font-bold text-teal-300 flex items-center gap-1.5 text-sm">
                    <FaUserTie className="text-teal-400" /> {viewingRoad.assigned_operator_name || 'Unassigned'}
                  </p>
                  {viewingRoad.assigned_operator?.email && (
                    <p className="text-[11px] text-slate-400 font-mono">Email: {viewingRoad.assigned_operator.email}</p>
                  )}
                </div>

                {/* Current Traffic Status */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FaTachometerAlt className="text-cyan-400" /> Live Traffic Telemetry Status
                  </h4>
                  {isLoadingView ? (
                    <div className="py-4 text-center font-mono text-slate-400 text-xs">Loading live telemetry from Supabase...</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block uppercase">Vehicle Count</span>
                        <span className="text-lg font-bold text-teal-400 font-mono mt-0.5 block">
                          {viewingDetail?.current_telemetry?.vehicle_count ?? (telemetryMap[viewingRoad.id]?.vehicle_count ?? 0)} veh
                        </span>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block uppercase">Average Speed</span>
                        <span className="text-lg font-bold text-cyan-400 font-mono mt-0.5 block">
                          {viewingDetail?.current_telemetry?.average_speed ?? (telemetryMap[viewingRoad.id]?.average_speed ?? 0)} km/h
                        </span>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 block uppercase">Congestion Level</span>
                        <div className="mt-1 flex justify-center">
                          <StatusBadge 
                            status={viewingDetail?.current_telemetry?.congestion_level ?? (telemetryMap[viewingRoad.id]?.congestion_level ?? 'Low')} 
                            type={getCongestionBadgeType(viewingDetail?.current_telemetry?.congestion_level ?? (telemetryMap[viewingRoad.id]?.congestion_level ?? 'Low'))} 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent Alerts */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FaExclamationTriangle className="text-amber-400" /> Recent Corridor Alerts
                  </h4>
                  {isLoadingView ? (
                    <div className="py-2 font-mono text-slate-400 text-xs">Loading alerts...</div>
                  ) : viewingDetail?.recent_alerts && viewingDetail.recent_alerts.length > 0 ? (
                    <div className="overflow-x-auto border border-slate-800 rounded-lg">
                      <table className="w-full text-left text-[11px] text-slate-300">
                        <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3">Alert Type</th>
                            <th className="py-2 px-3">Severity</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {viewingDetail.recent_alerts.map((alt) => (
                            <tr key={alt.id} className="hover:bg-slate-900/50">
                              <td className="py-2 px-3 text-slate-200 font-sans font-bold">{alt.alert_type}</td>
                              <td className="py-2 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  alt.severity === 'Critical' ? 'bg-rose-500/20 text-rose-400' :
                                  alt.severity === 'High' ? 'bg-orange-500/20 text-orange-400' : 'bg-amber-500/20 text-amber-400'
                                }`}>{alt.severity}</span>
                              </td>
                              <td className="py-2 px-3 text-slate-300">{alt.status}</td>
                              <td className="py-2 px-3 text-slate-400">{alt.created_at ? new Date(alt.created_at).toLocaleString() : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-500 text-[11px] text-center font-mono">
                      No active or recent alerts reported for this corridor.
                    </div>
                  )}
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800/80">
                  <div>Created Date: {viewingRoad.created_at ? new Date(viewingRoad.created_at).toLocaleString() : 'Recent'}</div>
                  <div>Updated Date: {viewingRoad.updated_at ? new Date(viewingRoad.updated_at).toLocaleString() : 'Recent'}</div>
                </div>

              </div>

              <div className="pt-2 flex justify-end border-t border-slate-800">
                <Button variant="secondary" onClick={() => setIsViewModalOpen(false)}>Close Details</Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: DELETE CONFIRMATION MODAL */}
        {isDeleteModalOpen && deletingRoad && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full glass-panel p-6 rounded-2xl border border-rose-500/30 space-y-4 animate-slide-up">
              <div className="flex items-center space-x-3 text-rose-400">
                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                  <FaTrash className="text-2xl" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Delete Road Corridor?</h3>
                  <p className="text-xs text-rose-400/80">This action will remove the corridor record from Supabase.</p>
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <p>Are you sure you want to delete <strong className="text-slate-100">'{deletingRoad.road_name}'</strong> ({deletingRoad.road_code})?</p>
                <p className="text-[11px] text-slate-400">Zone: {deletingRoad.zone}</p>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmDelete} className="bg-rose-500 hover:bg-rose-600 text-white font-bold">
                  Delete Road Corridor
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* AI Video Viewer Modal */}
        <AIVideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          roadId={selectedVideoRoadId}
        />

      </div>
    </DashboardLayout>
  );
};
