import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { User, Mail, Award, Clock, Layout } from 'lucide-react';
import { API_URL } from '../config';

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
  }, []);

  if (!user) return <div className="text-center p-10">Loading Profile...</div>;

  const completedCount = projects.filter(p => p.status === 'Completed').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white px-6 py-4 shadow-sm flex items-center gap-4">
        <a href="/dashboard" className="font-bold flex items-center gap-2 text-slate-600 hover:text-black">
          <Layout className="w-5 h-5" /> Dashboard
        </a>
        <span className="text-slate-300">/</span>
        <span className="font-bold text-black">Profile</span>
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