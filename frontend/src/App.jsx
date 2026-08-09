import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './components/common/ProtectedRoute';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminRoadsPage } from './pages/AdminRoadsPage';
import { AdminMonitoringPage } from './pages/AdminMonitoringPage';
import { OperatorManagementPage } from './pages/OperatorManagementPage';
import { RoadAssignmentPage } from './pages/RoadAssignmentPage';
import { AssignmentManagementPage } from './pages/AssignmentManagementPage';
import { ZoneManagementPage } from './pages/ZoneManagementPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminAlertsPage } from './pages/AdminAlertsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminHeatmapPage } from './pages/AdminHeatmapPage';

import { OperatorDashboard } from './pages/OperatorDashboard';
import { OperatorRoadsPage } from './pages/OperatorRoadsPage';
import { OperatorMonitoringPage } from './pages/OperatorMonitoringPage';
import { OperatorAlertsPage } from './pages/OperatorAlertsPage';
import { OperatorProfilePage } from './pages/OperatorProfilePage';
import { RoadDetailsPage } from './pages/RoadDetailsPage';

import { PublicDashboard } from './pages/PublicDashboard';
import { PublicRoadsPage } from './pages/PublicRoadsPage';
import { PublicAlertsPage } from './pages/PublicAlertsPage';
import { PublicMapPage } from './pages/PublicMapPage';
import { SignupPage } from './pages/SignupPage';

import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <Routes>
              {/* Public Portal Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/public/dashboard" element={<PublicDashboard />} />
              <Route path="/public/roads" element={<PublicRoadsPage />} />
              <Route path="/public/alerts" element={<PublicAlertsPage />} />
              <Route path="/public/map" element={<PublicMapPage />} />
              <Route path="/public" element={<Navigate to="/public/dashboard" replace />} />

              {/* Road Details Route */}
              <Route
                path="/roads/:id"
                element={
                  <ProtectedRoute allowedRoles={['Admin', 'Operator']}>
                    <RoadDetailsPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Routes */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/heatmap"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminHeatmapPage role="Admin" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/roads"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminRoadsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/zones"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <ZoneManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/operators"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <OperatorManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/assignments"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AssignmentManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/road-assignment"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AssignmentManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/monitoring"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminMonitoringPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/alerts"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminAlertsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

              {/* Protected Operator Routes */}
              <Route
                path="/operator/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['Operator', 'Admin']}>
                    <OperatorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operator/heatmap"
                element={
                  <ProtectedRoute allowedRoles={['Operator', 'Admin']}>
                    <AdminHeatmapPage role="Operator" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operator/roads"
                element={
                  <ProtectedRoute allowedRoles={['Operator', 'Admin']}>
                    <OperatorRoadsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operator/monitoring"
                element={
                  <ProtectedRoute allowedRoles={['Operator', 'Admin']}>
                    <OperatorMonitoringPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operator/alerts"
                element={
                  <ProtectedRoute allowedRoles={['Operator', 'Admin']}>
                    <OperatorAlertsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operator/profile"
                element={
                  <ProtectedRoute allowedRoles={['Operator', 'Admin']}>
                    <OperatorProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/operator" element={<Navigate to="/operator/dashboard" replace />} />

              {/* 404 Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
