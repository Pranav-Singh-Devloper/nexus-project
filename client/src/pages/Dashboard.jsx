import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus, Search, ChevronLeft, ChevronRight, Trash2, ArrowUpDown, ArrowUpRight, Radar, Sparkles,
  Maximize2, Rocket, FileText, Loader2,
} from 'lucide-react';
import { API_URL } from '../config';
import { useCurrentUser } from '../lib/useCurrentUser';
import { useToast } from '../lib/toast';
import { useGeneratePost } from '../lib/useGeneratePost';
import { isProcessing } from '../lib/research';
import { ease, fadeUp, stagger } from '../lib/motion';
import MarkdownReport from '../components/MarkdownReport';
import NotesPanel from '../components/NotesPanel';
import { StatusBadge, StatusOrb } from '../components/ResearchStatus';
import { Button, Card, ConfirmDialog, EmptyState, Modal, PageHeader, Segmented, Skeleton } from '../components/ui';

const FILTERS = [
  { value: 'All', label: 'All' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Initializing...', label: 'Processing' },
  { value: 'Failed', label: 'Failed' },
];

const IDEAS = [
  'Competitive landscape of AI note-taking apps',
  'Pricing trends in B2B SaaS for 2026',
  'How Gen Z discovers new fintech products',
  'Market size for home EV chargers in India',
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

// Cycles through what the AI is doing while a post is being written.
const GENERATING_STEPS = ['Reading the report…', 'Finding the hook…', 'Writing your post…', 'Picking hashtags…'];
const GeneratingLabel = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(n => (n + 1) % GENERATING_STEPS.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-flex h-5 min-w-[150px] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span key={i} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.3 }}>
          {GENERATING_STEPS[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const ProjectCard = ({ project, onOpen, onDelete }) => {
  const processing = isProcessing(project.status);
  const viewable = !processing;
  return (
    <motion.div variants={fadeUp} layout>
      <Card
        hover={viewable}
        className={`group relative overflow-hidden ${viewable ? 'cursor-pointer' : ''}`}
        onClick={viewable ? () => onOpen(project) : undefined}
      >
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <StatusOrb status={project.status} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-ink sm:text-[17px]" title={project.title}>{project.title}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <StatusBadge status={project.status} />
              <span className="text-xs font-medium text-muted">
                {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {viewable && (
              <span className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink-soft transition-all duration-300 group-hover:bg-surface-2 group-hover:text-ink sm:inline-flex">
                {project.status === 'Failed' ? 'Details' : 'View report'}
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            )}
            <Button
              variant="danger-ghost"
              size="icon"
              icon={Trash2}
              aria-label="Delete research"
              onClick={(e) => { e.stopPropagation(); onDelete(project); }}
            />
          </div>
        </div>
        {/* Indeterminate progress while the agent works */}
        {processing && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-info/10">
            <div className="h-full w-2/5 animate-scan rounded-full bg-gradient-to-r from-transparent via-info to-transparent" />
          </div>
        )}
      </Card>
    </motion.div>
  );
};

const ListSkeleton = () => (
  <div className="space-y-3">
    {[0, 1, 2].map(i => (
      <div key={i} className="card flex items-center gap-4 p-5" style={{ opacity: 1 - i * 0.25 }}>
        <Skeleton className="h-12 w-12 !rounded-2xl" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    ))}
  </div>
);

const Dashboard = () => {
  const user = useCurrentUser();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const [selectedProject, setSelectedProject] = useState(null);
  const [projectNotes, setProjectNotes] = useState([]);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { generate, generating, error: generateError } = useGeneratePost();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('All');

  // Nudge the AI engine awake (free hosting sleeps it) so it's ready when needed
  useEffect(() => {
    axios.post(`${API_URL}/api/warmup`, {}, { withCredentials: true }).catch(() => {});
  }, []);

  // Wait until the user stops typing before searching
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProjects = useCallback((isBackground = false) => {
    if (!isBackground) setLoading(true);
    const params = new URLSearchParams({ page, limit: 5, search: debouncedSearch, sort });
    if (filterStatus !== 'All') params.set('status', filterStatus);

    return axios.get(`${API_URL}/api/projects?${params}`, { withCredentials: true })
      .then(res => {
        setProjects(res.data.projects);
        setTotalPages(res.data.pagination.pages);
      })
      .catch(err => console.error(err))
      .finally(() => { if (!isBackground) setLoading(false); });
  }, [page, debouncedSearch, sort, filterStatus]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Refresh quietly while any agent is still working
  useEffect(() => {
    if (!projects.some(p => isProcessing(p.status))) return;
    const interval = setInterval(() => { fetchProjects(true); }, 3000);
    return () => clearInterval(interval);
  }, [projects, fetchProjects]);

  const openProject = async (project) => {
    setSelectedProject(project);
    setProjectNotes([]);
    try {
      const res = await axios.get(`${API_URL}/api/projects/${project.id}`, { withCredentials: true });
      setSelectedProject(res.data);
      setProjectNotes(res.data.notes || []);
    } catch (err) {
      console.error('Failed to fetch project details', err);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      await axios.post(`${API_URL}/api/projects`, { title: newTitle }, { withCredentials: true });
      setNewTitle('');
      setIsModalOpen(false);
      setFilterStatus('All');
      if (page === 1) fetchProjects(); else setPage(1);
      toast.success('Agent launched. Your report will appear here when it is ready.');
    } catch {
      toast.error('Failed to launch the research agent.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/api/projects/${toDelete.id}`, { withCredentials: true });
      setProjects(list => list.filter(p => p.id !== toDelete.id));
      setToDelete(null);
      fetchProjects(true);
    } catch {
      toast.error('Failed to delete.');
    } finally {
      setDeleting(false);
    }
  };

  const firstName = user?.name?.split(' ')[0];
  const searching = search.trim() !== debouncedSearch;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <PageHeader
        eyebrow="Mission control"
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description="Launch research agents, read their reports, and turn the best insights into posts."
        actions={<Button variant="accent" size="lg" icon={Plus} onClick={() => setIsModalOpen(true)}>New research</Button>}
      />

      {/* Search, filter, sort */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease }}
        className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center"
      >
        <div className="group relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent-ink" />
          <input
            type="text"
            placeholder="Search your research…"
            className="field h-12 !rounded-2xl !pl-11 !pr-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searching && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />}
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            options={FILTERS}
            value={filterStatus}
            onChange={(v) => { setFilterStatus(v); setPage(1); }}
            size="sm"
            className="flex-1 lg:flex-none"
          />
          <Button
            variant="outline"
            size="md"
            className="!h-11 shrink-0 !rounded-2xl"
            onClick={() => setSort(s => (s === 'desc' ? 'asc' : 'desc'))}
            title="Change sort order"
          >
            <motion.span animate={{ rotate: sort === 'desc' ? 0 : 180 }} transition={{ duration: 0.35, ease }}>
              <ArrowUpDown className="h-4 w-4" />
            </motion.span>
            <span className="hidden sm:inline">{sort === 'desc' ? 'Newest' : 'Oldest'}</span>
          </Button>
        </div>
      </motion.div>

      {/* List */}
      {loading ? (
        <ListSkeleton />
      ) : projects.length === 0 ? (
        debouncedSearch || filterStatus !== 'All' ? (
          <EmptyState icon={Search} title="Nothing matches">
            Try a different search or filter.
          </EmptyState>
        ) : (
          <EmptyState
            icon={Radar}
            title="No research yet"
            action={<Button variant="accent" icon={Rocket} onClick={() => setIsModalOpen(true)}>Launch your first agent</Button>}
          >
            Give an agent a market question. It searches the web and writes a full report for you.
          </EmptyState>
        )
      ) : (
        <motion.div
          key={`${page}-${filterStatus}-${sort}-${debouncedSearch}`}
          initial="hidden"
          animate="show"
          variants={stagger(0.06)}
          className="space-y-3"
        >
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} onOpen={openProject} onDelete={setToDelete} />
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button variant="outline" size="icon" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page" />
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`relative h-9 min-w-9 rounded-xl px-2 text-sm font-semibold transition-colors ${n === page ? 'text-on-primary' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}
              >
                {n === page && <motion.span layoutId="page-pill" className="absolute inset-0 rounded-xl bg-primary" />}
                <span className="relative">{n}</span>
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" icon={ChevronRight} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Next page" />
        </div>
      )}

      {/* New research */}
      <Modal
        open={isModalOpen}
        onClose={() => !creating && setIsModalOpen(false)}
        title="Launch a research agent"
        description="Describe what you want to know. The agent researches the web and writes a cited report."
        footer={(
          <>
            <span className="mr-auto hidden text-xs text-muted sm:block">⌘ + Enter to launch</span>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={creating}>Cancel</Button>
            <Button variant="accent" icon={Rocket} onClick={handleCreate} loading={creating} disabled={!newTitle.trim()}>Launch</Button>
          </>
        )}
      >
        <textarea
          className="field resize-none"
          rows="4"
          autoFocus
          placeholder="e.g. Analyze the competitive landscape of…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate(); }}
        />
        <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Need an idea?</p>
        <div className="flex flex-wrap gap-2">
          {IDEAS.map((idea, i) => (
            <motion.button
              key={idea}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setNewTitle(idea)}
              className="rounded-full border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-ink"
            >
              {idea}
            </motion.button>
          ))}
        </div>
      </Modal>

      {/* Report + notes */}
      <Modal
        open={!!selectedProject}
        onClose={() => !generating && setSelectedProject(null)}
        size="xl"
        title={selectedProject?.title}
        description={selectedProject && <span className="inline-flex items-center gap-2"><StatusBadge status={selectedProject.status} /></span>}
        bodyClassName="flex min-h-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden"
        className="sm:h-[88vh]"
      >
        {selectedProject && (
          <>
            <div className="relative flex min-h-0 flex-1 flex-col md:overflow-hidden">
              <div className="flex-1 px-6 py-6 sm:px-8 md:overflow-y-auto">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-ink"><FileText className="h-4 w-4 text-accent-ink" /> AI research report</p>
                  <Link to={`/projects/${selectedProject.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink">
                    <Maximize2 className="h-3.5 w-3.5" /> Full page
                  </Link>
                </div>
                {selectedProject.report === undefined ? (
                  <div className="space-y-3"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /></div>
                ) : (
                  <MarkdownReport content={selectedProject.report} fallback="No content generated." className="prose-sm" />
                )}
              </div>

              {selectedProject.report && selectedProject.status !== 'Failed' && (
                <div className="border-t border-line bg-surface-2/50 px-6 py-4 sm:px-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink">Turn this into a LinkedIn post</p>
                      <p className="text-xs text-muted">We'll write a draft with a hook, hashtags and an image.</p>
                    </div>
                    <Button variant="accent" icon={generating ? undefined : Sparkles} loading={generating} onClick={() => generate(selectedProject)}>
                      {generating ? <GeneratingLabel /> : 'Generate post'}
                    </Button>
                  </div>
                  {generateError && (
                    <p className="mt-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{generateError}</p>
                  )}
                </div>
              )}
            </div>

            <aside className="flex min-h-[420px] w-full flex-col border-t border-line bg-surface-2/40 p-6 md:min-h-0 md:w-[340px] md:border-l md:border-t-0">
              <NotesPanel projectId={selectedProject.id} notes={projectNotes} setNotes={setProjectNotes} className="flex-1" />
            </aside>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Delete this research?"
      >
        “{toDelete?.title}” and its notes will be removed. This can't be undone.
      </ConfirmDialog>
    </div>
  );
};

export default Dashboard;
