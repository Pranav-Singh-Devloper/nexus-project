import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, Sparkles, CalendarDays, SearchX } from 'lucide-react';
import { API_URL } from '../config';
import { useGeneratePost } from '../lib/useGeneratePost';
import { ease, fadeUp, stagger } from '../lib/motion';
import MarkdownReport from '../components/MarkdownReport';
import NotesPanel from '../components/NotesPanel';
import { StatusBadge } from '../components/ResearchStatus';
import { Button, Card, EmptyState, Skeleton } from '../components/ui';

const ProjectDetails = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [notes, setNotes] = useState([]);
  const [missing, setMissing] = useState(false);
  const { generate, generating, error } = useGeneratePost();

  // Reading progress bar along the top of the page
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    axios.get(`${API_URL}/api/projects/${id}`, { withCredentials: true })
      .then(res => { setProject(res.data); setNotes(res.data.notes || []); })
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-16 sm:px-6">
        <EmptyState icon={SearchX} title="Research not found" action={<Button to="/dashboard" variant="primary" icon={ArrowLeft}>Back to research</Button>}>
          It may have been deleted, or the link is wrong.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <motion.div style={{ scaleX: progress }} className="fixed inset-x-0 top-16 z-30 h-[3px] origin-left bg-accent" />
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10">
        <Link to="/dashboard" className="group mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" /> All research
        </Link>

        {!project ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-5 w-40" />
            <div className="card mt-8 space-y-3 p-8"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-4" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-3/4" /></div>
          </div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={stagger(0.08)}>
            <motion.header variants={fadeUp} className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-ink">
                  <span className="h-px w-6 bg-accent" /> Research report
                </p>
                <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">{project.title}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
                  <StatusBadge status={project.status} />
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(project.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  </span>
                </div>
              </div>
              {project.report && project.status !== 'Failed' && (
                <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                  <Button variant="accent" size="lg" icon={Sparkles} loading={generating} onClick={() => generate(project)}>
                    {generating ? 'Writing your post…' : 'Generate LinkedIn post'}
                  </Button>
                  {error && <p className="text-sm text-danger">{error}</p>}
                </div>
              )}
            </motion.header>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <motion.div variants={fadeUp}>
                <Card className="p-6 sm:p-10">
                  <MarkdownReport content={project.report} className="sm:prose-lg" />
                </Card>
              </motion.div>

              <motion.aside variants={fadeUp} transition={{ delay: 0.1, ease }}>
                <Card className="flex h-[70vh] flex-col p-5 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
                  <NotesPanel projectId={project.id} notes={notes} setNotes={setNotes} className="flex-1" />
                </Card>
              </motion.aside>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
};

export default ProjectDetails;
