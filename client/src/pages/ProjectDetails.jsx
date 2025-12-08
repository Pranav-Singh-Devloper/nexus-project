import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Layout, ArrowLeft, Edit2, Trash2 } from 'lucide-react';
import { API_URL } from '../config';

const ProjectDetails = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  
  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const pRes = await axios.get(`${API_URL}/api/projects/${id}`, { withCredentials: true });
        setProject(pRes.data);
        setNotes(pRes.data.notes || []);
      } catch (err) { alert("Project not found"); 
        console.log(err)
      }
    };
    fetchData();
  }, [id]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const res = await axios.post(`${API_URL}/api/notes`, { content: newNote, projectId: id }, { withCredentials: true });
    setNotes([...notes, res.data]);
    setNewNote("");
  };

  const handleDeleteNote = async (noteId) => {
    await axios.delete(`${API_URL}/api/notes/${noteId}`, { withCredentials: true });
    setNotes(notes.filter(n => n.id !== noteId));
  };

  if (!project) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white px-6 py-4 shadow-sm flex items-center gap-4">
        <a href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-black">
          <ArrowLeft className="w-5 h-5" /> Back
        </a>
        <h1 className="font-bold text-xl truncate">{project.title}</h1>
      </nav>

      <div className="max-w-6xl mx-auto mt-6 p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Report Section */}
        <div className="md:col-span-2 bg-white p-8 rounded-xl shadow-sm">
          <h2 className="text-lg font-bold mb-4">Research Report</h2>
          <div className="prose max-w-none text-slate-800 whitespace-pre-wrap">
            {project.report || "No report generated."}
          </div>
        </div>

        {/* Notes Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col h-[80vh] sticky top-24">
          <h2 className="text-lg font-bold mb-4">Notes</h2>
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {notes.map(n => (
              <div key={n.id} className="bg-slate-50 p-3 rounded border text-sm relative group">
                <p>{n.content}</p>
                <button onClick={() => handleDeleteNote(n.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-auto">
             <textarea 
                className="w-full border p-2 rounded mb-2" 
                rows="3" 
                placeholder="Add note..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
             />
             <button onClick={handleAddNote} className="w-full bg-black text-white py-2 rounded">Add Note</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;