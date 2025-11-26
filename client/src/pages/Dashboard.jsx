import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Layout, LogOut, Search, ChevronLeft, ChevronRight, Loader, CheckCircle, XCircle, Clock } from 'lucide-react';
import { API_URL } from '../config';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Resume Feature States
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 1. Initial User Load
  useEffect(() => {
    axios.get(`${API_URL}/api/current_user`, { withCredentials: true })
      .then(res => {
        if (!res.data) window.location.href = '/';
        setUser(res.data);
      });
  }, []);

  // 2. Fetch Projects Function (Updated to support background polling)
  const fetchProjects = (isBackground = false) => {
    // Only show big spinner if it's NOT a background refresh
    if (!isBackground) setLoading(true);
    
    axios.get(`${API_URL}/api/projects?page=${page}&limit=5&search=${search}`, { withCredentials: true })
      .then(res => {
        setProjects(res.data.projects);
        setTotalPages(res.data.pagination.pages);
        if (!isBackground) setLoading(false);
      })
      .catch(err => {
        console.error(err);
        if (!isBackground) setLoading(false);
      });
  };

  // 3. Initial Fetch & Search/Page changes
  useEffect(() => {
    fetchProjects();
  }, [page, search]);

  // 4. SMART POLLING (The Fix 🚀)
  // If any project is "Initializing...", poll every 3 seconds until done.
  useEffect(() => {
    const hasActiveMissions = projects.some(p => p.status === 'Initializing...');

    if (hasActiveMissions) {
      const interval = setInterval(() => {
        fetchProjects(true); // Pass true to avoid spinner flicker
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval); // Cleanup on unmount/change
    }
  }, [projects]); // Re-evaluate whenever projects update

  // 5. Create Project Handler
  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/projects`, { title: newTitle }, { withCredentials: true });
      setNewTitle("");
      setIsModalOpen(false);
      setPage(1);
      fetchProjects(); // Immediate refresh
    } catch (err) {
      alert("Failed to create mission");
      setLoading(false);
    }
  };

  // Helper to render status badge
  const renderStatus = (status) => {
    if (status === 'Completed') return <span className="text-green-600 flex items-center gap-1 text-sm font-medium"><CheckCircle className="w-4 h-4" /> Completed</span>;
    if (status === 'Failed') return <span className="text-red-600 flex items-center gap-1 text-sm font-medium"><XCircle className="w-4 h-4" /> Failed</span>;
    return <span className="text-blue-600 flex items-center gap-1 text-sm font-medium animate-pulse"><Clock className="w-4 h-4" /> {status}</span>;
  };

  if (!user) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {/* Navbar */}
      <nav className="bg-white px-6 py-4 shadow-sm flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Layout className="w-6 h-6" /> Nexus
        </h1>
        <div className="flex items-center gap-4">
          <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full border" />
          <a href={`${API_URL}/api/logout`} className="text-slate-500 hover:text-red-500">
            <LogOut className="w-5 h-5" />
          </a>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto mt-10 p-6">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h2 className="text-2xl font-bold text-slate-800">Mission Control</h2>
          
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search missions..." 
                className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
            >
              <Plus className="w-4 h-4" /> New Mission
            </button>
          </div>
        </div>

        {/* Project List */}
        {loading ? (
          <div className="text-center py-10"><Loader className="animate-spin mx-auto" /></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed text-slate-400">
            No missions found. Start a new one!
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map(p => (
              <div key={p.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-lg">{p.title}</h3>
                  <div className="mt-2 flex items-center gap-3">
                    {renderStatus(p.status)}
                    <span className="text-xs text-slate-400">• {new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {p.status === 'Completed' ? (
                  <button 
                    onClick={() => setSelectedProject(p)}
                    className="text-sm font-medium text-black border border-black px-4 py-2 rounded-lg hover:bg-black hover:text-white transition"
                  >
                    View Report
                  </button>
                ) : (
                  <button disabled className="text-sm font-medium text-slate-300 border border-slate-200 px-4 py-2 rounded-lg cursor-not-allowed">
                    Processing...
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex justify-center items-center gap-4 mt-8">
          <button 
            disabled={page <= 1} 
            onClick={() => setPage(p => p - 1)}
            className="p-2 border rounded hover:bg-slate-100 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages || 1}</span>
          <button 
            disabled={page >= totalPages} 
            onClick={() => setPage(p => p + 1)}
            className="p-2 border rounded hover:bg-slate-100 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Initialize New Agent</h3>
            <textarea 
              className="w-full border p-3 rounded-lg mb-4 focus:ring-2 focus:ring-black outline-none"
              rows="3"
              placeholder="e.g., Analyze the competitive landscape..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-black">Cancel</button>
              <button onClick={handleCreate} className="bg-black text-white px-6 py-2 rounded-lg hover:bg-slate-800">Launch</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold truncate">{selectedProject.title}</h3>
              <button onClick={() => setSelectedProject(null)} className="text-slate-500 hover:text-black">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50 text-slate-800 leading-relaxed whitespace-pre-wrap font-mono text-sm">
              {selectedProject.report || "No content generated."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;