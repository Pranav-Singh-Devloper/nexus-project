import { lazy, Suspense, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTheme } from '../../lib/theme';

// The shard field needs WebGPU (Chrome, Edge, Safari 26+). It's loaded only
// when the browser supports it, so other browsers never download it.
const AeroShards = lazy(() => import('./AeroShards'));
const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

const PALETTES = {
  dark: { shardColor: '#4A6BB0', accentColor: '#F4EDE0', lightMode: false },
  light: { shardColor: '#14213D', accentColor: '#2F4F95', lightMode: true },
};

// Soft brand-coloured glow used where WebGPU isn't available.
const Fallback = () => (
  <div className="absolute inset-0 overflow-hidden">
    <div className="animate-blob absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-coral/20 blur-3xl" />
    <div className="animate-blob absolute -left-48 top-1/3 h-[620px] w-[620px] rounded-full bg-[#2B4C8C]/25 blur-3xl [animation-delay:-6s]" />
    <div className="animate-blob absolute bottom-[-200px] right-1/4 h-[480px] w-[480px] rounded-full bg-navy/20 blur-3xl [animation-delay:-12s] dark:bg-[#4A6BB0]/20" />
  </div>
);

export default function AppBackground({ placement = 'full', count = 1100, className = '' }) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(!hasWebGPU);
  const palette = PALETTES[theme] || PALETTES.dark;

  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 -z-10 bg-bg ${className}`}>
      {failed ? <Fallback /> : (
        <Suspense fallback={null}>
          <AeroShards
            {...palette}
            placement={placement}
            count={count}
            backgroundColor="transparent"
            speed={reduced ? 0 : 0.8}
            intro={!reduced}
            paused={!!reduced}
            glow={theme === 'dark' ? 0.45 : 0.2}
            vignette={theme === 'dark' ? 0.35 : 0.15}
            grain={0.04}
            markers="plus"
            mouseInteraction
            mouseStrength={0.5}
            pulseOnClick
            holdToGather={false}
            parallax={0.4}
            dpr={1.5}
            onError={() => setFailed(true)}
          />
        </Suspense>
      )}
      {/* Keeps text readable over the busiest parts of the field */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--bg)_100%)] opacity-60" />
    </div>
  );
}
