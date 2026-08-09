import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { MainLayout } from '../layouts/MainLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FaTrafficLight, FaUser, FaShieldAlt, FaGlobe, FaQuestionCircle, FaEye, FaEyeSlash, FaUserPlus, FaArrowRight } from 'react-icons/fa';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showSuccess, showError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Operator');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    if (role === 'Admin') {
      setEmail('admin.chief@trafficvision.ai');
      setPassword('adminpass123');
    } else if (role === 'Public') {
      setEmail('akash.public@trafficvision.ai');
      setPassword('publicpass123');
    } else {
      setEmail('mahamanisha2005@gmail.com');
      setPassword('Traf@2026#MQPF');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const cleanEmail = email.trim();
      const cleanPassword = password.trim();
      const userProfile = await login(cleanEmail, cleanPassword);
      showSuccess(`Welcome back, ${userProfile.name}!`, 'Authenticated');
      
      const roleUpper = (userProfile.role || '').toUpperCase();
      if (roleUpper === 'ADMIN') {
        navigate('/admin/dashboard', { replace: true });
      } else if (roleUpper === 'PUBLIC') {
        navigate('/public/dashboard', { replace: true });
      } else {
        navigate('/operator/dashboard', { replace: true });
      }
    } catch (err) {
      showError(err.message || 'Invalid authentication credentials', 'Sign-In Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md animate-slide-up">
          
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-slate-900 border border-slate-800 mb-3 text-teal-400">
              <FaTrafficLight className="text-3xl" />
            </div>
            <h2 className="text-2xl font-bold text-slate-100 tracking-tight">System Authentication</h2>
            <p className="text-xs text-slate-400 mt-1">TrafficVision AI Portal Sign-In</p>
          </div>

          <Card className="shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Role Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Role Preset Quick Select (Demo)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  
                  <button
                    type="button"
                    onClick={() => handleRoleSelect('Operator')}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1 transition-all ${
                      selectedRole === 'Operator'
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FaUser />
                    <span>Operator</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleRoleSelect('Admin')}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1 transition-all ${
                      selectedRole === 'Admin'
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FaShieldAlt />
                    <span>Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleSelect('Public')}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1 transition-all ${
                      selectedRole === 'Public'
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FaGlobe />
                    <span>Public</span>
                  </button>

                </div>
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono"
                  placeholder="name@gmail.com or name@trafficvision.ai"
                />
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">Password</label>
                  <Link to="/forgot-password" className="text-xs text-teal-400 hover:underline flex items-center gap-1">
                    <FaQuestionCircle className="text-[10px]" />
                    <span>Forgot Password?</span>
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 pr-10 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono"
                    placeholder="Enter password or temporary password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-400 transition-colors text-sm"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 space-y-3">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Authenticating...' : 'Sign In & Access Console'}
                </Button>

                <Link
                  to="/public/dashboard"
                  className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-teal-400 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
                >
                  <FaGlobe />
                  <span>Browse Public Dashboard as Guest</span>
                  <FaArrowRight className="text-[10px]" />
                </Link>
              </div>

              {/* Public Sign Up Link */}
              <div className="text-center pt-4 border-t border-slate-800 text-xs text-slate-400">
                <span>Don't have a public account? </span>
                <Link to="/signup" className="text-teal-400 font-bold hover:underline inline-flex items-center gap-1">
                  <FaUserPlus className="text-xs" /> Register / Sign Up
                </Link>
              </div>

            </form>
          </Card>

        </div>
      </div>
    </MainLayout>
  );
};
