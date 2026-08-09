import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { 
  FaBrain, 
  FaVideo, 
  FaTrafficLight, 
  FaShieldAlt, 
  FaUserShield, 
  FaTv, 
  FaUsers, 
  FaArrowRight, 
  FaBolt, 
  FaCogs, 
  FaChartLine, 
  FaEnvelope, 
  FaBuilding, 
  FaCheckCircle, 
  FaBroadcastTower, 
  FaSlidersH 
} from 'react-icons/fa';

export const LandingPage = () => {
  const [contactForm, setContactForm] = useState({ name: '', agency: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (contactForm.name && contactForm.email) {
      setSubmitted(true);
    }
  };

  return (
    <MainLayout>
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-24 border-b border-slate-800/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.18),rgba(255,255,255,0))]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-semibold mb-6 shadow-lg shadow-teal-500/10">
            <FaBolt className="animate-pulse" />
            <span>NEXT-GENERATION SMART CITY TRAFFIC ENGINE</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-slate-100 tracking-tight max-w-5xl mx-auto leading-[1.1]">
            Predict & Resolve Urban Congestion <span className="gradient-text">In Real-Time</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            TrafficVision AI integrates computer vision, deep predictive forecasting, and automated adaptive signal control to revolutionize urban mobility.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link to="/public/dashboard">
              <Button size="lg" className="w-full sm:w-auto space-x-2 px-8 py-3.5 text-base">
                <span>Browse Public Portal</span>
                <FaArrowRight />
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto px-8 py-3.5 text-base">
                Public Sign Up
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto px-8 py-3.5 text-base">
                Portal Login
              </Button>
            </Link>
          </div>

          {/* Key Metrics Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <Card className="text-center p-5">
              <p className="text-3xl sm:text-4xl font-extrabold text-teal-400 font-mono">98.4%</p>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">Prediction Accuracy</p>
            </Card>
            <Card className="text-center p-5">
              <p className="text-3xl sm:text-4xl font-extrabold text-cyan-400 font-mono">&lt; 120ms</p>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">Edge Camera Latency</p>
            </Card>
            <Card className="text-center p-5">
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono">-34%</p>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">Avg Congestion Delay</p>
            </Card>
            <Card className="text-center p-5">
              <p className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-mono">24 / 7</p>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">Autonomous Optimization</p>
            </Card>
          </div>
        </div>
      </section>

      {/* 2. ABOUT & ROLE EXPLANATIONS SECTION */}
      <section id="about" className="py-24 border-b border-slate-900 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-2">About TrafficVision AI</h2>
            <h3 className="text-3xl sm:text-4xl font-bold text-slate-100">Unified Intelligent Traffic Management</h3>
            <p className="text-slate-400 mt-4 text-sm leading-relaxed">
              Designed for smart cities, TrafficVision AI bridges city administrators, traffic monitoring operators, and the public to eliminate bottlenecks and optimize signal cycles across urban grid networks.
            </p>
          </div>

          {/* User Roles Section */}
          <div id="roles" className="pt-4">
            <div className="text-center mb-10">
              <h3 className="text-xl font-bold text-slate-200">Role-Based System Access</h3>
              <p className="text-xs text-slate-400 mt-1">Tailored control environments engineered for every stakeholder.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              
              {/* Role 1: Admin */}
              <Card className="flex flex-col justify-between h-full border-t-2 border-t-purple-500">
                <div>
                  <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit mb-4">
                    <FaUserShield className="text-2xl" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-bold text-slate-100">Administrator</h4>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/30">City-Wide Governance</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    Full system administration and infrastructure oversight across the entire metropolitan area.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span>Provision and manage Operator accounts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span>Assign city corridors and roads to specific operators</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 font-bold">•</span>
                      <span>Access full city-wide analytics & AI model parameter settings</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <Link to="/login" className="text-xs text-purple-400 hover:underline flex items-center gap-1 font-medium">
                    <span>Access Admin Console</span> <FaArrowRight className="text-[10px]" />
                  </Link>
                </div>
              </Card>

              {/* Role 2: Traffic Operator */}
              <Card className="flex flex-col justify-between h-full border-t-2 border-t-teal-500">
                <div>
                  <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl w-fit mb-4">
                    <FaTv className="text-2xl" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-bold text-slate-100">Traffic Operator</h4>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded border border-teal-500/30">Live Corridor Desk</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    Frontline operational desk for monitoring assigned road corridors and responding to live traffic events.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 font-bold">•</span>
                      <span>Monitor live telemetry & camera feeds for assigned roads</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 font-bold">•</span>
                      <span>Execute manual traffic signal overrides when necessary</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 font-bold">•</span>
                      <span>Manage incident alerts and trigger emergency green waves</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <Link to="/login" className="text-xs text-teal-400 hover:underline flex items-center gap-1 font-medium">
                    <span>Access Operator Desk</span> <FaArrowRight className="text-[10px]" />
                  </Link>
                </div>
              </Card>

              {/* Role 3: Public User */}
              <Card className="flex flex-col justify-between h-full border-t-2 border-t-cyan-500">
                <div>
                  <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl w-fit mb-4">
                    <FaUsers className="text-2xl" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-bold text-slate-100">Public User</h4>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/30">City Transparency</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    Smart city transparency platform providing citizens with real-time congestion awareness and traffic advisories.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>View city-wide congestion forecasts and delay warnings</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>Receive public detour broadcasts and road safety notices</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>Benefit from automated AI green-wave flow optimization</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <Link to="/public/dashboard" className="text-xs text-cyan-400 font-bold hover:underline flex items-center gap-1">
                    <span>Explore Portal</span> <FaArrowRight className="text-[10px]" />
                  </Link>
                  <Link to="/signup" className="text-xs text-teal-400 font-bold hover:underline flex items-center gap-1">
                    <span>Sign Up</span> <FaArrowRight className="text-[10px]" />
                  </Link>
                </div>
              </Card>

            </div>
          </div>

        </div>
      </section>

      {/* 3. SYSTEM FEATURES SECTION */}
      <section id="features" className="py-24 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-2">Core Engine Features</h2>
            <h3 className="text-3xl sm:text-4xl font-bold text-slate-100">Enterprise AI Traffic Capabilities</h3>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card title="Computer Vision Analytics" subtitle="Edge Processing">
              <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl w-fit mb-3">
                <FaVideo className="text-xl" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Processes CCTV and edge camera streams to classify vehicle density, average speeds, and anomalous slowdowns.
              </p>
            </Card>

            <Card title="Predictive Forecasting" subtitle="Deep Learning Engine">
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl w-fit mb-3">
                <FaBrain className="text-xl" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Forecasts traffic build-ups 15 to 60 minutes in advance using time-series models to prevent bottleneck formation.
              </p>
            </Card>

            <Card title="Adaptive Signal Control" subtitle="Dynamic Green Waves">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit mb-3">
                <FaTrafficLight className="text-xl" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dynamically adjusts green light timings to clear high-density lanes and provide emergency vehicle corridors.
              </p>
            </Card>

            <Card title="Automated Incident Desk" subtitle="Instant Alerts">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl w-fit mb-3">
                <FaSlidersH className="text-xl" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Detects lane obstructions, signal failures, and sudden congestion spikes, automatically alerting operators.
              </p>
            </Card>
          </div>

        </div>
      </section>

      {/* 4. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-24 border-b border-slate-900 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-2">System Architecture</h2>
            <h3 className="text-3xl sm:text-4xl font-bold text-slate-100">How TrafficVision AI Works</h3>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            
            <div className="glass-panel rounded-xl p-5 relative">
              <div className="text-2xl font-extrabold text-teal-400 font-mono mb-2">01</div>
              <h4 className="text-sm font-bold text-slate-100 mb-1">Edge Data Ingestion</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time video feeds and IoT road sensor telemetry ingested at sub-120ms latency.
              </p>
            </div>

            <div className="glass-panel rounded-xl p-5 relative">
              <div className="text-2xl font-extrabold text-cyan-400 font-mono mb-2">02</div>
              <h4 className="text-sm font-bold text-slate-100 mb-1">Vision & Telemetry Analysis</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                YOLO vision models extract vehicle counts, speed vectors, and lane occupancy index.
              </p>
            </div>

            <div className="glass-panel rounded-xl p-5 relative">
              <div className="text-2xl font-extrabold text-amber-400 font-mono mb-2">03</div>
              <h4 className="text-sm font-bold text-slate-100 mb-1">Predictive AI Inference</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Neural forecasting algorithms calculate 15-min queue building probabilities.
              </p>
            </div>

            <div className="glass-panel rounded-xl p-5 relative">
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mb-2">04</div>
              <h4 className="text-sm font-bold text-slate-100 mb-1">Adaptive Control Action</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automated signal timing adjustments executed & alerts dispatched to operator consoles.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 5. CONTACT SECTION */}
      <section id="contact" className="py-24 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-2">Enterprise Engagement</h2>
              <h3 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">Deploy TrafficVision AI For Your City</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                Our traffic engineering specialists work with municipal authorities, transit agencies, and smart city integrators to deploy edge vision hardware and predictive software infrastructure.
              </p>

              <div className="space-y-4 text-xs text-slate-300">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg">
                    <FaEnvelope />
                  </div>
                  <span>Enterprise Inquiry: enterprise@trafficvision.ai</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg">
                    <FaBuilding />
                  </div>
                  <span>Smart City Operations Center - Headquarters</span>
                </div>
              </div>
            </div>

            <Card className="shadow-2xl">
              {submitted ? (
                <div className="text-center py-8 space-y-3">
                  <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full">
                    <FaCheckCircle className="text-3xl" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-100">Enterprise Inquiry Received</h4>
                  <p className="text-xs text-slate-300">
                    Thank you, <span className="text-teal-400 font-semibold">{contactForm.name}</span>. A smart city solutions engineer will contact your office within 24 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <h4 className="text-base font-bold text-slate-100 mb-2">Request System Demonstration</h4>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="Jane Doe"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Municipal Agency / Organization</label>
                    <input
                      type="text"
                      value={contactForm.agency}
                      onChange={(e) => setContactForm({ ...contactForm, agency: e.target.value })}
                      placeholder="Department of Transportation"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Work Email</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="jane.doe@citydot.gov"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Message / Deployment Scope</label>
                    <textarea
                      rows={3}
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      placeholder="Describe your city corridor monitoring requirements..."
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Submit Inquiry
                  </Button>
                </form>
              )}
            </Card>

          </div>

        </div>
      </section>
    </MainLayout>
  );
};
