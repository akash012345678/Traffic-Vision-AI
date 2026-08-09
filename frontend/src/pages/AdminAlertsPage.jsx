import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { AlertDetailsSidePanel } from '../components/common/AlertDetailsSidePanel';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useToast } from '../contexts/ToastContext';
import apiClient from '../services/api';
import { 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaFilter, 
  FaSync, 
  FaClock, 
  FaSearch, 
  FaUserTie, 
  FaTrash, 
  FaEye, 
  FaTimes, 
  FaRoad, 
  FaStickyNote,
  FaCheck,
  FaUserCheck,
  FaFileDownload,
  FaPlus,
  FaPaperclip
} from 'react-icons/fa';

export const AdminAlertsPage = () => {
  const { showSuccess, showError } = useToast();
  
  // Data States
  const [alerts, setAlerts] = useState([]);
  const [operators, setOperators] = useState([]);
  const [allRoads, setAllRoads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modal Visibility States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Active Alert State
  const [activeAlert, setActiveAlert] = useState(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [noteStatus, setNoteStatus] = useState('ACTIVE');

  // Create Form State
  const [createData, setCreateData] = useState({
    road_id: '',
    alert_type: 'Heavy Traffic',
    severity: 'High',
    status: 'ACTIVE',
    notes: '',
    attachment_url: '',
    assigned_operator_id: ''
  });

  // Fetch Alerts, Operators & Roads from Supabase
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [alertsRes, opsRes, roadsRes] = await Promise.all([
        apiClient.get('/alerts'),
        apiClient.get('/operators'),
        apiClient.get('/roads')
      ]);

      const alertList = Array.isArray(alertsRes) ? alertsRes : (alertsRes.items || []);
      const opList = Array.isArray(opsRes) ? opsRes : (opsRes.items || []);
      const roadList = Array.isArray(roadsRes) ? roadsRes : (roadsRes.items || []);

      setAlerts(alertList);
      setOperators(opList);
      setAllRoads(roadList);
      if (roadList.length > 0 && !createData.road_id) {
        setCreateData(prev => ({ ...prev, road_id: roadList[0].id }));
      }
    } catch (err) {
      showError(err.message || 'Failed to fetch incident alerts from Supabase');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh polling every 5 seconds for real-time synchronization
    const timer = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  // Compute Summary Metrics
  const stats = useMemo(() => {
    const total = alerts.length;
    const active = alerts.filter(a => (a.status || '').toUpperCase() === 'ACTIVE').length;
    const inProgress = alerts.filter(a => (a.status || '').toUpperCase() === 'IN_PROGRESS' || (a.status || '').toUpperCase() === 'IN PROGRESS').length;
    const resolved = alerts.filter(a => (a.status || '').toUpperCase() === 'RESOLVED').length;
    const critical = alerts.filter(a => (a.severity || '').toUpperCase() === 'CRITICAL' || (a.severity || '').toUpperCase() === 'HIGH').length;
    return { total, active, inProgress, resolved, critical };
  }, [alerts]);

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const type = a.alert_type || '';
      const roadName = a.road?.road_name || '';
      const zoneName = a.road?.zone || '';
      const opName = a.assigned_operator?.name || '';

      const matchesSearch = 
        !q ||
        type.toLowerCase().includes(q) ||
        roadName.toLowerCase().includes(q) ||
        zoneName.toLowerCase().includes(q) ||
        opName.toLowerCase().includes(q);

      const matchesSeverity = 
        severityFilter === 'ALL' ||
        (a.severity || '').toUpperCase() === severityFilter.toUpperCase();

      const matchesStatus = 
        statusFilter === 'ALL' ||
        (a.status || '').toUpperCase() === statusFilter.toUpperCase();

      const matchesType =
        typeFilter === 'ALL' ||
        (a.alert_type || '').toLowerCase() === typeFilter.toLowerCase();

      return matchesSearch && matchesSeverity && matchesStatus && matchesType;
    });
  }, [alerts, searchQuery, severityFilter, statusFilter, typeFilter]);

  // Create Incident Alert Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createData.road_id) {
      showError('Please select a road corridor', 'Validation Error');
      return;
    }

    try {
      const payload = {
        road_id: parseInt(createData.road_id, 10),
        alert_type: createData.alert_type,
        severity: createData.severity,
        status: createData.status,
        notes: createData.notes.trim() || undefined,
        attachment_url: createData.attachment_url.trim() || undefined,
        assigned_operator_id: createData.assigned_operator_id ? parseInt(createData.assigned_operator_id, 10) : undefined
      };

      await apiClient.post('/alerts', payload);
      showSuccess(`Triggered '${createData.alert_type}' alert in Supabase`, 'Alert Created');
      setIsCreateModalOpen(false);
      setCreateData({
        road_id: allRoads[0]?.id || '',
        alert_type: 'Heavy Traffic',
        severity: 'High',
        status: 'ACTIVE',
        notes: '',
        attachment_url: '',
        assigned_operator_id: ''
      });
      fetchData();
    } catch (err) {
      showError(err.message || 'Failed to trigger incident alert');
    }
  };

  // Assign Operator Submit
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!activeAlert) return;

    try {
      const opId = selectedOperatorId ? parseInt(selectedOperatorId, 10) : null;
      await apiClient.put(`/alerts/${activeAlert.id}/assign`, { operator_id: opId });
      showSuccess(`Updated operator assignment for Alert #${activeAlert.id}`, 'Operator Assigned');
      setIsAssignModalOpen(false);
      setActiveAlert(null);
      fetchData();
    } catch (err) {
      showError(err.message || 'Failed to assign operator');
    }
  };

  // Update Status & Notes Submit
  const handleNotesSubmit = async (e) => {
    e.preventDefault();
    if (!activeAlert) return;

    try {
      await apiClient.put(`/alerts/${activeAlert.id}/status`, { status: noteStatus });
      await apiClient.put(`/alerts/${activeAlert.id}/notes`, { 
        notes: noteText.trim(),
        attachment_url: attachmentUrl.trim() || undefined
      });
      showSuccess(`Updated status and notes for Alert #${activeAlert.id}`, 'Alert Updated');
      setIsNotesModalOpen(false);
      setActiveAlert(null);
      fetchData();
    } catch (err) {
      showError(err.message || 'Failed to update alert');
    }
  };

  // 1-Click Resolve Alert
  const handle1ClickResolve = async (alertObj) => {
    try {
      await apiClient.put(`/alerts/${alertObj.id}/status`, { status: 'RESOLVED' });
      showSuccess(`Alert #${alertObj.id} marked RESOLVED`, 'Alert Resolved');
      fetchData();
    } catch (err) {
      showError(err.message || 'Failed to resolve alert');
    }
  };

  // Confirm Delete Alert
  const handleConfirmDelete = async () => {
    if (!activeAlert) return;

    try {
      await apiClient.delete(`/alerts/${activeAlert.id}`);
      showSuccess(`Alert #${activeAlert.id} deleted from Supabase`, 'Alert Deleted');
      setIsDeleteModalOpen(false);
      setActiveAlert(null);
      fetchData();
    } catch (err) {
      showError(err.message || 'Failed to delete alert');
    }
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!filteredAlerts.length) {
      showError('No incident alerts available to export', 'Export Error');
      return;
    }

    const headers = ['Alert ID', 'Alert Type', 'Road Name', 'Road Code', 'Zone', 'Severity', 'Status', 'Assigned Operator', 'Created Time', 'Updated Time', 'Notes'];
    const rows = filteredAlerts.map(a => [
      `#ALT-${a.id.toString().padStart(3, '0')}`,
      `"${(a.alert_type || '').replace(/"/g, '""')}"`,
      `"${(a.road?.road_name || '').replace(/"/g, '""')}"`,
      `"${(a.road?.road_code || '').replace(/"/g, '""')}"`,
      `"${(a.road?.zone || '').replace(/"/g, '""')}"`,
      `"${(a.severity || 'Medium').replace(/"/g, '""')}"`,
      `"${(a.status || 'ACTIVE').replace(/"/g, '""')}"`,
      `"${(a.assigned_operator?.name || 'Unassigned').replace(/"/g, '""')}"`,
      a.created_at ? new Date(a.created_at).toLocaleString() : '',
      a.updated_at ? new Date(a.updated_at).toLocaleString() : '',
      `"${(a.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `city_incident_alerts_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess(`Exported ${filteredAlerts.length} incident alert records to CSV`, 'Export Complete');
  };

  const getSeverityBadgeType = (sev) => {
    switch ((sev || '').toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH': return 'red';
      case 'MEDIUM':
      case 'MODERATE': return 'amber';
      case 'LOW': return 'green';
      default: return 'amber';
    }
  };

  const getStatusBadgeType = (st) => {
    switch ((st || '').toUpperCase()) {
      case 'ACTIVE': return 'red';
      case 'IN_PROGRESS':
      case 'IN PROGRESS': return 'amber';
      case 'RESOLVED': return 'green';
      default: return 'amber';
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="space-y-6 animate-fade-in w-full">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
              <FaExclamationTriangle className="text-amber-400 text-xl" />
              <span>City Incident Alerts Operations Console</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Admin Operations: Dispatch alerts, assign duty personnel, update resolution notes, and audit incident history in Supabase.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={fetchData} className="space-x-1.5">
              <FaSync className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh Alerts</span>
            </Button>

            <Button size="sm" onClick={handleExportCSV} className="space-x-1.5 bg-slate-900 border border-slate-800 text-slate-200 hover:text-white">
              <FaFileDownload />
              <span>Export CSV</span>
            </Button>

            <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="space-x-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
              <FaPlus />
              <span>Trigger Alert</span>
            </Button>
          </div>
        </div>

        {/* Summary Dashboard Widgets */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Alerts</p>
              <h3 className="text-xl font-bold text-slate-100 mt-0.5 font-mono">{stats.total}</h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <FaExclamationTriangle className="text-base" />
            </div>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Incidents</p>
              <h3 className="text-xl font-bold text-rose-400 mt-0.5 font-mono">{stats.active}</h3>
            </div>
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <FaExclamationTriangle className="text-base" />
            </div>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">In Progress</p>
              <h3 className="text-xl font-bold text-amber-400 mt-0.5 font-mono">{stats.inProgress}</h3>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <FaClock className="text-base" />
            </div>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Resolved</p>
              <h3 className="text-xl font-bold text-emerald-400 mt-0.5 font-mono">{stats.resolved}</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <FaCheckCircle className="text-base" />
            </div>
          </div>

          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Critical Severity</p>
              <h3 className="text-xl font-bold text-rose-500 mt-0.5 font-mono">{stats.critical}</h3>
            </div>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <FaExclamationTriangle className="text-base" />
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
              <input
                type="text"
                placeholder="Search type, road, zone, or assigned operator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <FaTimes />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              
              {/* Type Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <FaFilter className="text-amber-400 text-[10px]" /> Type:
                </span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ALL">All Alert Types</option>
                  <option value="Heavy Traffic">Heavy Traffic</option>
                  <option value="Accident">Accident</option>
                  <option value="Road Block">Road Block</option>
                  <option value="Construction">Construction</option>
                  <option value="Weather">Weather</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>

              {/* Severity Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">Severity:</span>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ALL">All Severities</option>
                  <option value="LOW">LOW</option>
                  <option value="MODERATE">MODERATE</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>

              {(searchQuery || severityFilter !== 'ALL' || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
                <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setSeverityFilter('ALL'); setStatusFilter('ALL'); setTypeFilter('ALL'); }} className="text-xs text-rose-400 hover:text-rose-300">
                  Reset
                </Button>
              )}
            </div>

          </div>
        </Card>

        {/* Complete Exact 10-Column Alert Table */}
        <Card title="City Incident Alerts Roster" subtitle={`Displaying ${filteredAlerts.length} of ${alerts.length} total incident alerts in Supabase`}>
          {isLoading ? (
            <SkeletonTable rows={6} />
          ) : filteredAlerts.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <FaExclamationTriangle className="text-4xl text-slate-700 mx-auto" />
              <p className="text-sm font-medium text-slate-400">No incident alerts found matching current search or filters.</p>
              <Button size="sm" variant="secondary" onClick={() => { setSearchQuery(''); setSeverityFilter('ALL'); setStatusFilter('ALL'); setTypeFilter('ALL'); }}>
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase bg-slate-900/90 text-slate-400 border-b border-slate-800 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 whitespace-nowrap">Alert ID</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Alert Type</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Road</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Zone</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Severity</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Assigned Operator</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Created Time</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Updated Time</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredAlerts.map((a) => {
                    const isResolved = (a.status || '').toUpperCase() === 'RESOLVED';

                    return (
                      <tr key={a.id} className="hover:bg-slate-900/50 transition-colors">
                        
                        {/* 1. Alert ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap text-xs">
                          #ALT-{a.id.toString().padStart(3, '0')}
                        </td>

                        {/* 2. Alert Type */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-md text-xs font-semibold inline-block">
                            {a.alert_type}
                          </span>
                        </td>

                        {/* 3. Road */}
                        <td className="py-3.5 px-4 font-bold text-slate-100 whitespace-nowrap">
                          <span className="block">{a.road?.road_name || 'City Corridor'}</span>
                          <span className="text-[10px] text-teal-400 font-mono block font-normal">{a.road?.road_code || `RD-${a.road_id}`}</span>
                        </td>

                        {/* 4. Zone */}
                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                          <span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-xs">
                            {a.road?.zone || 'Zone Alpha'}
                          </span>
                        </td>

                        {/* 5. Severity */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={a.severity || 'Medium'} type={getSeverityBadgeType(a.severity)} />
                        </td>

                        {/* 6. Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={a.status || 'ACTIVE'} type={getStatusBadgeType(a.status)} />
                        </td>

                        {/* 7. Assigned Operator */}
                        <td className="py-3.5 px-4 text-slate-300 font-sans text-xs whitespace-nowrap">
                          {a.assigned_operator ? (
                            <span className="text-teal-400 flex items-center gap-1.5 font-medium">
                              <FaUserTie className="text-slate-400 text-xs" /> {a.assigned_operator.name}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Unassigned</span>
                          )}
                        </td>

                        {/* 8. Created Time */}
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                          {a.created_at ? new Date(a.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}
                        </td>

                        {/* 9. Updated Time */}
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                          {a.updated_at ? new Date(a.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : (a.created_at ? new Date(a.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent')}
                        </td>

                        {/* 10. Actions Column */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                          {/* View Side Panel Specs */}
                          <button
                            onClick={() => { setActiveAlert(a); setIsSidePanelOpen(true); }}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-teal-400 hover:border-teal-500/40 transition-colors"
                            title="Inspect Alert Side Information Panel"
                          >
                            <FaEye />
                          </button>

                          {/* Assign Operator */}
                          <button
                            onClick={() => { setActiveAlert(a); setSelectedOperatorId(a.assigned_operator?.id || ''); setIsAssignModalOpen(true); }}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-purple-400 hover:border-purple-500/40 transition-colors"
                            title="Assign Operator to Incident"
                          >
                            <FaUserTie />
                          </button>

                          {/* Update Status & Notes */}
                          <button
                            onClick={() => { 
                              setActiveAlert(a); 
                              setNoteStatus(a.status || 'ACTIVE'); 
                              setNoteText(a.notes || ''); 
                              setAttachmentUrl(a.attachment_url || '');
                              setIsNotesModalOpen(true); 
                            }}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                            title="Update Status, Notes & Attachments"
                          >
                            <FaStickyNote />
                          </button>

                          {/* 1-Click Resolve */}
                          {!isResolved && (
                            <button
                              onClick={() => handle1ClickResolve(a)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                              title="Mark Incident Resolved"
                            >
                              <FaCheck />
                            </button>
                          )}

                          {/* Delete Alert */}
                          <button
                            onClick={() => { setActiveAlert(a); setIsDeleteModalOpen(true); }}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                            title="Delete Incident Record"
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
        </Card>

        {/* MODAL 1: TRIGGER INCIDENT ALERT MODAL */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-xl w-full glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <FaExclamationTriangle className="text-amber-400" /> Trigger New Incident Alert
                </h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Road */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Road Corridor *</label>
                    <select
                      value={createData.road_id}
                      onChange={(e) => setCreateData({ ...createData, road_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {allRoads.map(r => (
                        <option key={r.id} value={r.id}>{r.road_name} ({r.road_code || `RD-${r.id}`}) - [{r.zone}]</option>
                      ))}
                    </select>
                  </div>

                  {/* Alert Type (6 Core Types) */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Alert Type *</label>
                    <select
                      value={createData.alert_type}
                      onChange={(e) => setCreateData({ ...createData, alert_type: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Heavy Traffic">Heavy Traffic</option>
                      <option value="Accident">Accident</option>
                      <option value="Road Block">Road Block</option>
                      <option value="Construction">Construction</option>
                      <option value="Weather">Weather</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Severity */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Severity Rating *</label>
                    <select
                      value={createData.severity}
                      onChange={(e) => setCreateData({ ...createData, severity: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  {/* Assign Operator */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Assign Operator (Optional)</label>
                    <select
                      value={createData.assigned_operator_id}
                      onChange={(e) => setCreateData({ ...createData, assigned_operator_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="">Auto-assign (Corridor Operator)</option>
                      {operators.map(op => (
                        <option key={op.id} value={op.id}>{op.name} ({op.email})</option>
                      ))}
                    </select>
                  </div>

                </div>

                {/* Notes */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Incident Notes / Initial Instructions</label>
                  <textarea
                    rows={2}
                    placeholder="Enter incident description, blockage details, or dispatch notes..."
                    value={createData.notes}
                    onChange={(e) => setCreateData({ ...createData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Attachment URL */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Attachment URL / Image Link (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={createData.attachment_url}
                    onChange={(e) => setCreateData({ ...createData, attachment_url: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                  <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
                    Trigger Incident Alert
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: ASSIGN OPERATOR MODAL */}
        {isAssignModalOpen && activeAlert && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 animate-slide-up">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <FaUserTie className="text-purple-400" /> Assign Operator to Alert #{activeAlert.id}
                </h3>
                <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Select Duty Operator *</label>
                  <select
                    value={selectedOperatorId}
                    onChange={(e) => setSelectedOperatorId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="">Unassign / Default</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.id}>{op.name} ({op.email})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <Button type="button" variant="secondary" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
                    Save Assignment
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: UPDATE STATUS & RESOLUTION NOTES MODAL */}
        {isNotesModalOpen && activeAlert && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 animate-slide-up">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <FaStickyNote className="text-amber-400" /> Update Alert #{activeAlert.id} Notes & Status
                </h3>
                <button onClick={() => setIsNotesModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleNotesSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Alert Status *</label>
                  <select
                    value={noteStatus}
                    onChange={(e) => setNoteStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="DISMISSED">DISMISSED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Operational Resolution Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Enter resolution details, dispatch clearance notes, or actions taken..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Attachment Link (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <Button type="button" variant="secondary" onClick={() => setIsNotesModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
                    Save Updates
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: DELETE CONFIRMATION MODAL */}
        {isDeleteModalOpen && activeAlert && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full glass-panel p-6 rounded-2xl border border-rose-500/30 space-y-4 animate-slide-up">
              <div className="flex items-center space-x-3 text-rose-400">
                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                  <FaTrash className="text-2xl" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Delete Incident Alert?</h3>
                  <p className="text-xs text-rose-400/80">This action will remove the alert record from Supabase.</p>
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <p>Are you sure you want to delete Alert <strong className="text-slate-100">#ALT-{activeAlert.id.toString().padStart(3, '0')}</strong> ({activeAlert.alert_type})?</p>
                <p className="text-[11px] text-slate-400">Corridor: {activeAlert.road?.road_name}</p>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmDelete} className="bg-rose-500 hover:bg-rose-600 text-white font-bold">
                  Delete Alert
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Side Information Panel Drawer */}
        <AlertDetailsSidePanel
          isOpen={isSidePanelOpen}
          onClose={() => setIsSidePanelOpen(false)}
          alertData={activeAlert}
          isLoading={false}
        />

      </div>
    </DashboardLayout>
  );
};
