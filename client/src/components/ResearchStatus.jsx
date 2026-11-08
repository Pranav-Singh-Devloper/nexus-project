import { CheckCircle2, XCircle, AlertTriangle, Radar } from 'lucide-react';
import { Badge } from './ui';
import { isProcessing } from '../lib/research';

export const StatusBadge = ({ status }) => {
  if (status === 'Completed') return <Badge tone="success" icon={CheckCircle2}>Completed</Badge>;
  if (status === 'Demo Mode') return <Badge tone="warning" icon={AlertTriangle}>Demo mode · rate limit hit</Badge>;
  if (status === 'Failed') return <Badge tone="danger" icon={XCircle}>Failed</Badge>;
  return <Badge tone="info" pulse>{status || 'Processing'}</Badge>;
};

// Round icon on the left of a research card; spins a radar sweep while the agent works.
export const StatusOrb = ({ status }) => {
  if (isProcessing(status)) {
    return (
      <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-info/12 text-info">
        <div className="absolute inset-0 animate-spin-slow [animation-duration:2.4s] [background:conic-gradient(from_0deg,transparent_70%,color-mix(in_oklab,var(--info)_45%,transparent))]" />
        <Radar className="relative h-5 w-5" />
      </div>
    );
  }
  const map = {
    Completed: ['bg-success/12 text-success', CheckCircle2],
    Failed: ['bg-danger/10 text-danger', XCircle],
    'Demo Mode': ['bg-warning/12 text-warning', AlertTriangle],
  };
  const [cls, Icon] = map[status];
  return (
    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-6 ${cls}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
};
