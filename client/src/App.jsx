import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import { API_URL } from './config';
import Profile from './pages/Profile';
import ProjectDetails from './pages/ProjectDetails';
import Auth from './pages/Auth';

// Login Component (Internal)
const Login = () => (
  <div className="flex h-screen items-center justify-center bg-slate-50">
    <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl text-center">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Nexus</h1>
      <p className="text-slate-500 mb-8">Autonomous Market Intelligence</p>
      <button
        onClick={() => window.location.href = `${API_URL}/auth/google`}
        className="flex w-full items-center justify-center gap-3 rounded-lg bg-black px-4 py-3 text-white hover:bg-slate-800 transition"
      >
        <LogIn className="h-5 w-5" /> <span>Continue with Google</span>
      </button>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/projects/:id" element={<ProjectDetails />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;