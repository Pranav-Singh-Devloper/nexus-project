import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Mail, Layout, Linkedin, Twitter, RefreshCw, Files } from 'lucide-react';
import { API_URL } from '../config';
import { connectionInfo, reconnectUrl, formatExpiry } from '../utils/connections';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    axios.get(`${API_URL}/api/current_user`, { withCredentials: true })
      .then(res => {
        if (!res.data) window.location.href = '/';
        setUser(res.data);
      });
      
      // Fetch all history without limits/search for stats
    axios.get(`${API_URL}/api/projects?limit=100`, { withCredentials: true })
      .then(res => setProjects(res.data.projects));

    // Handle LinkedIn redirect params
    const params = new URLSearchParams(window.location.search);
    const linkedinSuccess = params.get('linkedin');
    const linkedinError = params.get('error');

    if (linkedinSuccess) {
      console.log("LinkedIn successfully connected!");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (linkedinError) {
      console.error("LinkedIn Connection Error:", linkedinError);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const xSuccess = params.get('x');
    const xError = params.get('error');

    if (xSuccess) {
      console.log("X successfully connected!");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (xError && xError.startsWith('x_')) {
      console.error("X Connection Error:", xError);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (!user) return <div className="text-center p-10">Loading Profile...</div>;

  const completedCount = projects.filter(p => p.status === 'Completed').length;
  
  const hasLinkedIn = user.socialAccounts?.some(acc => acc.provider === 'linkedin');
  const hasX = user.socialAccounts?.some(acc => acc.provider === 'x');
  const linkedin = connectionInfo(user, 'linkedin');

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white px-6 py-4 shadow-sm flex items-center gap-4">
        <a href="/dashboard" className="font-bold flex items-center gap-2 text-slate-600 hover:text-black">
          <Layout className="w-5 h-5" /> Dashboard
        </a>
        <span className="text-slate-300">/</span>
        <span className="font-bold text-black">Profile</span>
        <a href="/posts" className="ml-auto flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-black">
          <Files className="w-4 h-4" /> Posts
        </a>
      </nav>

      <main className="max-w-3xl mx-auto mt-10 p-6">
        {/* User Card */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-6 mb-8">
          <img src={user.avatar} alt="Profile" className="w-24 h-24 rounded-full border-4 border-slate-50" />
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{user.name}</h1>
            <div className="flex items-center gap-2 text-slate-500 mt-2">
              <Mail className="w-4 h-4" /> {user.email}
            </div>
            <div className="flex gap-2 mt-4">
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                Free Tier
              </span>
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                 Verified
              </span>
            </div>
            <div className="mt-6 border-t border-slate-100 pt-5 flex flex-wrap gap-4">
              {hasLinkedIn ? (
                <div className={`inline-flex items-center gap-3 border px-4 py-2 rounded-lg text-sm ${
                  linkedin.expired ? 'bg-red-50 text-red-700 border-red-200'
                    : linkedin.expiringSoon ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <Linkedin className="w-4 h-4" />
                  <span>
                    <span className="font-medium">{linkedin.expired ? 'LinkedIn expired' : 'LinkedIn connected'}</span>
                    {!linkedin.expired && <span className="block text-xs opacity-80">{formatExpiry(linkedin)}</span>}
                  </span>
                  <a
                    href={reconnectUrl('linkedin', '/profile')}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md ${
                      linkedin.expired || linkedin.expiringSoon ? 'bg-[#0A66C2] text-white hover:bg-[#004182]' : 'bg-white/70 hover:bg-white'
                    }`}
                    title="LinkedIn connections last 60 days. Reconnecting renews it."
                  >
                    <RefreshCw className="w-3 h-3" /> Reconnect
                  </a>
                </div>
              ) : (
                <a 
                  href={reconnectUrl('linkedin', '/profile')}
                  className="inline-flex items-center gap-2 bg-[#0A66C2] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#004182] shadow-sm transition-all hover:shadow-md"
                >
                  <Linkedin className="w-4 h-4" /> Connect LinkedIn
                </a>
              )}
              
              {hasX ? (
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-5 py-2.5 rounded-lg text-sm font-medium">
                  <Twitter className="w-4 h-4" /> X Connected
                </div>
              ) : (
                <a 
                  href={`${API_URL}/auth/x`}
                  className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 shadow-sm transition-all hover:shadow-md"
                >
                  <Twitter className="w-4 h-4" /> Connect X
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-slate-400 text-sm font-medium mb-1">Total Missions</div>
            <div className="text-3xl font-bold text-slate-800">{projects.length}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-slate-400 text-sm font-medium mb-1">Completed</div>
            <div className="text-3xl font-bold text-emerald-600">{completedCount}</div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-slate-400 text-sm font-medium mb-1">Account Age</div>
            <div className="text-3xl font-bold text-blue-600">
               {Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24))} <span className="text-sm text-slate-400 font-normal">days</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;