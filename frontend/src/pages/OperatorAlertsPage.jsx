import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { AlertDetailsSidePanel } from '../components/common/AlertDetailsSidePanel';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import apiClient from '../services/api';
import { 
  FaExclamationTriangle, 
  FaSync, 
  FaSearch, 
  FaFilter, 
  FaRoad, 
  FaStickyNote, 
  FaUserTie, 
  FaTimes, 
  FaEdit,
  FaCheckCircle,
  FaClock,
  FaEye,
  FaCheck,
  FaHistory,
  FaFileDownload,
  FaPaperclip
} from 'react-icons/fa';

export const OperatorAlertsPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  // Data States
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modal Visibility States
  const [activeAlert, setActiveAlert] = useState(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  
  const [noteText, setNoteText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [noteStatus, setNoteStatus] = useState('ACTIVE');

  // Fetch Operator Assigned Alerts
  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const params = { severity: severityFilter, status: statusFilter, alert_type: typeFilter };
      const res = await apiClient.get('/alerts', { params });
      const alertList = Array.isArray(res) ? res : (res.items || []);
      setAlerts(alertList);
    } catch (err) {
      showError(err.message || 'Failed to fetch assigned incident alerts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // 5-second polling for real-time synchronization with Admin Control Desk
    const timer = setInterval(() => {
      fetchAlerts();
    }, 5000);

    return () => clearInterval(timer);
  }, [severityFilter, statusFilter, typeFilter]);

  // Compute Summary Metrics
  const stats = useMemo(() => {
    const total = alerts.length;
    const active = alerts.filter(a => (a.status || '').toUpperCase() === 'ACTIVE').length;
    const inProgress = alerts.filter(a => (a.status || '').toUpperCase() === 'IN_PROGRESS' || (a.status || '').toUpperCase() === 'IN PROGRESS').length;
    const resolved = alerts.filter(a => (a.status || '').toUpperCase() === 'RESOLVED').length;
    return { total, active, inProgress, resolved };
  }, [alerts]);

  // Filtered Alerts List
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const type = a.alert_type || '';
      const roadName = a.road?.road_name || '';
      const zoneName = a.road?.zone || '';

      const matchesSearch = 
        !q ||
        type.toLowerCase().includes(q) ||
        roadName.toLowerCase().includes(q) ||
        zoneName.toLowerCase().includes(q);

      return matchesSearch;
    });
  }, [alerts, searchQuery]);

  // Status Transition Handler
  const handleStatusChange = async (alertId, newStatus) => {
    setUpdatingId(alertId);
    try {
      await apiClient.put(`/alerts/${alertId}/status`, { status: newStatus });
      showSuccess(`Status for Alert #${alertId} updated to '${newStatus}' in Supabase`, 'Status Updated');
      fetchAlerts();
    } catch (err) {
      showError(err.message || 'Failed to update alert status');
    } finally {
      setUpdatingId(null);
    }
  };

  // 1-Click Mark Resolved
  const handleMarkResolved = async (alertObj) => {
    try {
      await apiClient.put(`/alerts/${alertObj.id}/status`, { status: 'RESOLVED' });
      showSuccess(`Alert #${alertObj.id} marked RESOLVED`, 'Alert Resolved');
      fetchAlerts();
    } catch (err) {
      showError(err.message || 'Failed to mark alert resolved');
    }
  };

  // Open Notes Modal
  const handleOpenNotesModal = (alertObj) => {
    setActiveAlert(alertObj);
    setNoteStatus(alertObj.status || 'ACTIVE');
    setNoteText(alertObj.notes || '');
    setAttachmentUrl(alertObj.attachment_url || '');
    setIsNotesModalOpen(true);
  };

  // Save Notes Submit
  const handleSaveNotes = async (e) => {
    e.preventDefault();
    if (!activeAlert) return;

    try {
      await apiClient.put(`/alerts/${activeAlert.id}/status`, { status: noteStatus });
      await apiClient.put(`/alerts/${activeAlert.id}/notes`, { 
        notes: noteText.trim(),
        attachment_url: attachmentUrl.trim() || undefined
      });
      showSuccess(`Updated resolution notes & attachments for Alert #${activeAlert.id}`, 'Notes Saved');
      setIsNotesModalOpen(false);
      setActiveAlert(null);
      fetchAlerts();
    } catch (err) {
      showError(err.message || 'Failed to save notes');
    }
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!filteredAlerts.length) {
      showError('No assigned alerts available to export', 'Export Error');
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
      `"${(a.assigned_operator?.name || user?.name || 'Operator').replace(/"/g, '""')}"`,
      a.created_at ? new Date(a.created_at).toLocaleString() : '',
      a.updated_at ? new Date(a.updated_at).toLocaleString() : '',
      `"${(a.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `operator_assigned_alerts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess(`Exported ${filteredAlerts.length} assigned alerts to CSV`, 'Export Complete');
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
    <DashboardLayout role="Operator">
      <div className="space-y-6 animate-fade-in w-full">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
              <FaExclamationTriangle className="text-amber-400 text-xl" />
              <span>Assigned Incident Alerts Desk</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Duty Console: Displaying active incident alerts on road corridors assigned to <span className="text-teal-400 font-semibold">{user?.name}</span> in Supabase.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={fetchAlerts} className="space-x-1.5">
              <FaSync className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh Assigned Feeds</span>
            </Button>

            <Button size="sm" onClick={handleExportCSV} className="space-x-1.5 bg-slate-900 border border-slate-800 text-slate-200 hover:text-white">
              <FaFileDownload />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Duty Dashboard Metric Widgets */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned Alerts</p>
              <h3 className="text-2xl font-bold text-slate-100 mt-0.5 font-mono">{stats.total}</h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
              <FaExclamationTriangle className="text-lg" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Incidents</p>
              <h3 className="text-2xl font-bold text-rose-400 mt-0.5 font-mono">{stats.active}</h3>
            </div>
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
              <FaExclamationTriangle className="text-lg" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">In Progress</p>
              <h3 className="text-2xl font-bold text-amber-400 mt-0.5 font-mono">{stats.inProgress}</h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
              <FaClock className="text-lg" />
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Resolved</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-0.5 font-mono">{stats.resolved}</h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <FaCheckCircle className="text-lg" />
            </div>
          </div>
        </div>

        {/* Search & Filters Toolbar */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
              <input
                type="text"
                placeholder="Search assigned alert type, road, or zone..."
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
                <span className="text-xs text-slate-400 font-medium">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ALL">All Types</option>
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

            </div>

          </div>
        </Card>

        {/* Exact 10-Column Alert Table */}
        <Card title="Assigned Incidents Roster" subtitle={`Displaying ONLY alerts assigned to ${user?.name}`}>
          {isLoading ? (
            <SkeletonTable rows={5} />
          ) : filteredAlerts.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <FaExclamationTriangle className="text-4xl text-slate-700 mx-auto" />
              <p className="text-sm font-medium text-slate-400">No incident alerts assigned to your duty corridors match current criteria.</p>
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
                          <span className="block">{a.road?.road_name || 'Assigned Corridor'}</span>
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
                          <select
                            value={(a.status || 'ACTIVE').toUpperCase()}
                            disabled={updatingId === a.id}
                            onChange={(e) => handleStatusChange(a.id, e.target.value)}
                            className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500 cursor-pointer font-semibold"
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="IN_PROGRESS">IN PROGRESS</option>
                            <option value="RESOLVED">RESOLVED</option>
                            <option value="DISMISSED">DISMISSED</option>
                          </select>
                        </td>

                        {/* 7. Assigned Operator */}
                        <td className="py-3.5 px-4 text-teal-400 font-sans text-xs whitespace-nowrap">
                          <span className="flex items-center gap-1.5 font-medium">
                            <FaUserTie className="text-slate-400 text-xs" /> {a.assigned_operator?.name || user?.name || 'Assigned'}
                          </span>
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
                          {/* Inspect Side Information Panel */}
                          <button
                            onClick={() => { setActiveAlert(a); setIsSidePanelOpen(true); }}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-teal-400 hover:border-teal-500/40 transition-colors"
                            title="Inspect Alert Details Side Panel"
                          >
                            <FaEye />
                          </button>

                          {/* Add/Edit Operational Resolution Notes */}
                          <button
                            onClick={() => handleOpenNotesModal(a)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                            title="Add Resolution Notes & Attachments"
                          >
                            <FaStickyNote />
                          </button>

                          {/* 1-Click Mark Resolved */}
                          {!isResolved && (
                            <button
                              onClick={() => handleMarkResolved(a)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                              title="Mark Alert Resolved"
                            >
                              <FaCheck />
                            </button>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* MODAL: ADD/EDIT RESOLUTION NOTES & ATTACHMENTS */}
        {isNotesModalOpen && activeAlert && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 animate-slide-up">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <FaStickyNote className="text-amber-400" /> Operational Notes - Alert #{activeAlert.id}
                </h3>
                <button onClick={() => setIsNotesModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleSaveNotes} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Status *</label>
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
                  <label className="block text-slate-300 font-semibold mb-1">Resolution Notes & Clearance Details</label>
                  <textarea
                    rows={3}
                    placeholder="Enter dispatch notes, traffic team clearance report, or observations..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Attachment Link (Image / Report URL)</label>
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
                    Save Resolution Notes
                  </Button>
                </div>
              </form>
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
