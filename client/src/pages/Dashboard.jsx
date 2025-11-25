import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Layout, LogOut, Search, ChevronLeft, ChevronRight, Loader } from 'lucide-react';

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


  // 1. Initial Load
  useEffect(() => {
    axios.get('http://localhost:5001/api/current_user', { withCredentials: true })
      .then(res => {
        if (!res.data) window.location.href = '/';
        setUser(res.data);
      });
  }, []);

  // 2. Fetch Projects (Runs whenever page/search changes)
  const fetchProjects = () => {
    setLoading(true);
    axios.get(`http://localhost:5001/api/projects?page=${page}&limit=5&search=${search}`, { withCredentials: true })
      .then(res => {
        setProjects(res.data.projects);
        setTotalPages(res.data.pagination.pages);
        setLoading(false);
      })
      .catch(err => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, [page, search]); // Dependency Array: Re-run when these change

  // 3. Create Project Handler


  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setLoading(true); // Start loading
    try {
      await axios.post('http://localhost:5001/api/projects', { title: newTitle }, { withCredentials: true });
      setNewTitle("");
      setIsModalOpen(false);
      setPage(1); // Reset to first page
      fetchProjects(); // Refresh list to see new report
    } catch (err) {
      alert("Failed to create mission");
    } finally {
      setLoading(false); // Stop loading
    }
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
          <a href="http://localhost:5001/api/logout" className="text-slate-500 hover:text-red-500">
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
                  <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">{p.status} • {new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => setSelectedProject(p)} // Open Modal
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  View Report →
                </button>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Initialize New Agent</h3>
            <textarea 
              className="w-full border p-3 rounded-lg mb-4 focus:ring-2 focus:ring-black outline-none"
              rows="3"
              placeholder="e.g., Analyze the competitive landscape of vegan coffee shops in Texas..."
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
        {/* Report View Modal */}
        {selectedProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
              {/* Header */}
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="text-xl font-bold truncate">{selectedProject.title}</h3>
                <button onClick={() => setSelectedProject(null)} className="text-slate-500 hover:text-black">
                  <LogOut className="w-5 h-5" /> {/* Close Icon */}
                </button>
              </div>
              
              {/* Scrollable Content */}
              <div className="p-6 overflow-y-auto bg-slate-50 text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedProject.report ? selectedProject.report : "No report generated yet."}
              </div>
            </div>
  </div>
)}
    </div>
  );
};

export default Dashboard;