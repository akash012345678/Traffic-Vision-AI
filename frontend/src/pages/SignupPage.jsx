import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { MainLayout } from '../layouts/MainLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FaTrafficLight, FaUser, FaEnvelope, FaLock, FaPhone, FaArrowRight, FaSignInAlt } from 'react-icons/fa';
import apiClient from '../services/api';

export const SignupPage = () => {
  const navigate = useNavigate();
  const { setAuthUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.strip ? password.strip() : password.trim(),
        phone: phone.trim() || undefined
      };

      const res = await apiClient.post('/auth/signup', payload);
      
      if (res.access_token && res.user) {
        localStorage.setItem('tv_token', res.access_token);
        localStorage.setItem('tv_user', JSON.stringify(res.user));
        showSuccess(`Account created! Welcome to TrafficVision AI, ${res.user.name}.`, 'Public Account Registered');
        window.location.href = '/public/dashboard';
      }
    } catch (err) {
      showError(err.message || 'Registration failed. Please check your information.', 'Signup Error');
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
            <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Public Account Sign Up</h2>
            <p className="text-xs text-slate-400 mt-1">Register for Public Portal Access to TrafficVision AI</p>
          </div>

          <Card className="shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaUser className="text-teal-400 text-xs" /> Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  placeholder="e.g. Jane Doe"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaEnvelope className="text-teal-400 text-xs" /> Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono"
                  placeholder="name@example.com"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaLock className="text-teal-400 text-xs" /> Create Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono"
                  placeholder="Minimum 6 characters"
                />
              </div>

              {/* Phone (Optional) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FaPhone className="text-slate-400 text-xs" /> Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button type="submit" className="w-full flex items-center justify-center space-x-2" disabled={isSubmitting}>
                  <span>{isSubmitting ? 'Creating Account...' : 'Register Public Account'}</span>
                  <FaArrowRight className="text-xs" />
                </Button>
              </div>

              {/* Footer Login Link */}
              <div className="text-center pt-4 border-t border-slate-800 text-xs text-slate-400">
                <span>Already have an account? </span>
                <Link to="/login" className="text-teal-400 font-bold hover:underline inline-flex items-center gap-1">
                  <FaSignInAlt className="text-xs" /> Sign In
                </Link>
              </div>

            </form>
          </Card>

        </div>
      </div>
    </MainLayout>
  );
};
