import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Plus, Layout, LogOut, Search, ChevronLeft, ChevronRight, 
  Loader, CheckCircle, XCircle, Clock, Trash2, Edit2, User 
} from 'lucide-react';
import { API_URL } from '../config';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Project Details & Notes State
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectNotes, setProjectNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState("");

  // Resume Feature States (Search, Sort, Filter, Pagination)
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState("desc"); 
  const [filterStatus, setFilterStatus] = useState("All");

  // 1. Initial User Load
  useEffect(() => {
    axios.get(`${API_URL}/api/current_user`, { withCredentials: true })
      .then(res => {
        if (!res.data) window.location.href = '/';
        setUser(res.data);
      });
  }, []);

  // 2. Fetch Projects List
  const fetchProjects = (isBackground = false) => {
    if (!isBackground) setLoading(true);
    
    // Construct Query String
    let url = `${API_URL}/api/projects?page=${page}&limit=5&search=${search}&sort=${sort}`;
    if (filterStatus !== 'All') url += `&status=${filterStatus}`; 
    
    axios.get(url, { withCredentials: true })
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

  // 3. React to changes (Search/Filter/Sort/Page)
  useEffect(() => {
    fetchProjects();
  }, [page, search, sort, filterStatus]);

  // 4. Smart Polling (Auto-refresh if AI is processing)
  useEffect(() => {
    const hasActiveMissions = projects.some(p => p.status === 'Initializing...');
    if (hasActiveMissions) {
      const interval = setInterval(() => { fetchProjects(true); }, 3000);
      return () => clearInterval(interval);
    }
  }, [projects]);

  // 5. Fetch Single Project Details (Includes Notes)
  const openProjectModal = async (project) => {
    setSelectedProject(project);
    // Fetch fresh details including notes (READ Op #2)
    try {
      const res = await axios.get(`${API_URL}/api/projects/${project.id}`, { withCredentials: true });
      setProjectNotes(res.data.notes || []);
    } catch (err) {
      console.error("Failed to fetch notes");
    }
  };

  // --- CRUD HANDLERS ---

  // CREATE Project
  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/projects`, { title: newTitle }, { withCredentials: true });
      setNewTitle("");
      setIsModalOpen(false);
      setPage(1);
      fetchProjects();
    } catch (err) { alert("Failed to create mission"); setLoading(false); }
  };

  // DELETE Project
  const handleDeleteProject = async (e, id) => {
    e.stopPropagation(); 
    if (!window.confirm("Delete this mission?")) return;
    try {
      await axios.delete(`${API_URL}/api/projects/${id}`, { withCredentials: true });
      fetchProjects();
    } catch (err) { alert("Failed to delete"); }
  };

  // --- NOTES HANDLERS (2nd Entity CRUD) ---

  // CREATE Note
  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedProject) return;
    try {
      const res = await axios.post(`${API_URL}/api/notes`, {
        content: newNote,
        projectId: selectedProject.id
      }, { withCredentials: true });
      
      setProjectNotes([...projectNotes, res.data]); // Update UI instantly
      setNewNote("");
    } catch (err) { alert("Failed to add note"); }
  };

  // DELETE Note
  const handleDeleteNote = async (noteId) => {
    if (!window.confirm("Delete note?")) return;
    try {
      await axios.delete(`${API_URL}/api/notes/${noteId}`, { withCredentials: true });
      setProjectNotes(projectNotes.filter(n => n.id !== noteId));
    } catch (err) { alert("Failed to delete note"); }
  };

  // START EDITING Note
  const startEditing = (note) => {
    setEditingNoteId(note.id);
    setEditNoteText(note.content);
  };

  // UPDATE Note
  const handleUpdateNote = async (noteId) => {
    try {
      const res = await axios.put(`${API_URL}/api/notes/${noteId}`, {
        content: editNoteText
      }, { withCredentials: true });
      
      // Update UI
      setProjectNotes(projectNotes.map(n => n.id === noteId ? res.data : n));
      setEditingNoteId(null);
    } catch (err) { alert("Failed to update note"); }
  };

  // 6. Helper: Render Status Badge
const renderStatus = (status) => {
    if (status === 'Completed') return (
      <span className="text-emerald-600 flex items-center gap-1.5 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
        <CheckCircle className="w-3.5 h-3.5" /> Completed
      </span>
    );
    
    // --- NEW CASE: DEMO MODE ---
    if (status === 'Demo Mode') return (
      <span className="text-amber-600 flex items-center gap-1.5 text-xs font-medium bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
        <AlertTriangle className="w-3.5 h-3.5" /> Demo Mode - Rate Limit Hit
      </span>
    );
    // ---------------------------

    if (status === 'Failed') return (
      <span className="text-red-600 flex items-center gap-1.5 text-xs font-medium bg-red-50 px-2 py-1 rounded-full border border-red-100">
        <XCircle className="w-3.5 h-3.5" /> Failed
      </span>
    );
    
    return (
      <span className="text-blue-600 flex items-center gap-1.5 text-xs font-medium bg-blue-50 px-2 py-1 rounded-full border border-blue-100 animate-pulse">
        <Clock className="w-3.5 h-3.5" /> {status}
      </span>
    );
  };

  if (!user) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {/* Navbar */}
      <nav className="bg-white px-6 py-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Layout className="w-6 h-6" /> Nexus
        </h1>
        <div className="flex items-center gap-4">
          {/* Profile Link */}
          <a href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full border" />
            <span className="text-sm font-medium hidden sm:block">{user.name}</span>
          </a>
          <a href={`${API_URL}/api/logout`} className="text-slate-500 hover:text-red-500" title="Logout">
            <LogOut className="w-5 h-5" />
          </a>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto mt-10 p-6">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-slate-800">Mission Control</h2>
          
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search missions..." 
                className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> New Mission
            </button>
          </div>
        </div>

        {/* Sort & Filter */}
        <div className="flex gap-4 mb-6">
            <select className="p-2 border rounded-lg bg-white text-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
            </select>
            <select className="p-2 border rounded-lg bg-white text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="All">All Status</option>
                <option value="Completed">Completed</option>
                <option value="Initializing...">Processing</option>
                <option value="Failed">Failed</option>
            </select>
        </div>

        {/* Project List */}
        {loading ? (
          <div className="text-center py-10"><Loader className="animate-spin mx-auto text-slate-400" /></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed text-slate-400">
            No missions found.
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 text-lg truncate" title={p.title}>{p.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {renderStatus(p.status)}
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center">
                  {p.status === 'Completed' ? (
                    <button 
                      onClick={() => openProjectModal(p)}
                      className="text-sm font-medium text-slate-700 bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 hover:text-black transition-colors shadow-sm"
                    >
                      View Report
                    </button>
                  ) : (
                    <button disabled className="text-sm font-medium text-slate-400 bg-slate-50 border border-slate-100 px-4 py-2 rounded-lg cursor-not-allowed select-none">Processing...</button>
                  )}
                  <button onClick={(e) => handleDeleteProject(e, p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Mission">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex justify-center items-center gap-4 mt-8">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 border rounded hover:bg-slate-100 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages || 1}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 border rounded hover:bg-slate-100 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </main>

      {/* New Mission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Initialize New Agent</h3>
            <textarea className="w-full border p-3 rounded-lg mb-4 focus:ring-2 focus:ring-black outline-none" rows="3" placeholder="e.g., Analyze the competitive landscape..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-black">Cancel</button>
              <button onClick={handleCreate} className="bg-black text-white px-6 py-2 rounded-lg hover:bg-slate-800">Launch</button>
            </div>
          </div>
        </div>
      )}

      {/* View Report & Notes Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0">
              <h3 className="text-xl font-bold truncate pr-4">{selectedProject.title}</h3>
              <div className="flex items-center gap-2">
                 <a href={`/projects/${selectedProject.id}`} className="text-xs text-blue-600 hover:underline mr-4">Full Page View</a>
                 <button onClick={() => setSelectedProject(null)} className="text-slate-500 hover:text-black">
                    <XCircle className="w-6 h-6" />
                 </button>
              </div>
            </div>

            {/* Modal Body - Grid Layout */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              
              {/* Left Column: AI Report */}
              <div className="flex-1 p-6 overflow-y-auto border-r border-slate-100 bg-slate-50">
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Layout className="w-4 h-4" /> AI Research Report
                </h4>
                <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedProject.report || "No content generated."}
                </div>
              </div>

              {/* Right Column: Notes (CRUD Feature) */}
              <div className="w-full md:w-80 bg-white p-6 flex flex-col border-l">
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Edit2 className="w-4 h-4" /> Analyst Notes
                </h4>
                
                {/* Note List */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                  {projectNotes.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No notes yet.</p>
                  ) : (
                    projectNotes.map(note => (
                      <div key={note.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm group relative hover:border-blue-200 transition-colors">
                        
                        {/* Edit Mode Check */}
                        {editingNoteId === note.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea 
                              className="w-full border p-2 rounded bg-white" 
                              rows="2"
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditingNoteId(null)} className="text-xs text-slate-500">Cancel</button>
                              <button onClick={() => handleUpdateNote(note.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-slate-700 pr-6 break-words">{note.content}</p>
                            <span className="text-[10px] text-slate-400 block mt-1">{new Date(note.createdAt).toLocaleDateString()}</span>
                            
                            {/* Actions */}
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditing(note)} className="text-slate-400 hover:text-blue-600"><Edit2 className="w-3 h-3" /></button>
                              <button onClick={() => handleDeleteNote(note.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add Note Input */}
                <div className="mt-auto pt-4 border-t">
                  <textarea 
                    className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-black outline-none resize-none bg-slate-50 focus:bg-white transition-colors"
                    rows="2"
                    placeholder="Add a finding..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <button 
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="w-full mt-2 bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Add Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;