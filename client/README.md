# Nexus client

The React front end for Nexus: research dashboard, report viewer, post composer and posts library.

**Stack:** React 19 · Vite 7 · Tailwind CSS v4 · framer-motion · react-router 7 · react-markdown · lucide icons · vgpu (WebGPU background)

## Run

```bash
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:5001
npm run dev              # http://localhost:5173
npm run build            # production build in dist/
npm run lint
```

The client only talks to the Node server (`VITE_API_URL`) and sends the session cookie with every request (`withCredentials`).

## Structure

```
src/
├── App.jsx                     Routes; public pages + signed-in pages inside AppLayout
├── index.css                   Design tokens (light/dark), glass utilities, keyframes
├── components/
│   ├── layout/AppLayout.jsx    Glass nav, mobile tab bar, page transitions, background
│   ├── layout/ThemeToggle.jsx  Theme button + Light/Dark/System picker
│   ├── backgrounds/            AeroShards (WebGPU) + AppBackground wrapper with CSS fallback
│   ├── ui.jsx                  Button, Card, Badge, Modal, Segmented tabs, Banner, Logo…
│   ├── Toaster.jsx             Toast notifications (useToast)
│   ├── ThemeProvider.jsx       Theme state + circular reveal on switch
│   ├── MarkdownReport.jsx      Sanitised Markdown renderer for research reports
│   └── NotesPanel.jsx          Analyst notes (add / edit / delete)
├── lib/                        Hooks and helpers (current user, motion presets, brand vectors…)
├── pages/
│   ├── Auth.jsx                Sign in / create account
│   ├── Dashboard.jsx           Research list, search, report modal, generate post
│   ├── ProjectDetails.jsx      Full-page report + notes
│   ├── Posts.jsx               Drafts / scheduled / published / failed
│   ├── Profile.jsx             Account, stats, LinkedIn/X connections, theme
│   ├── Legal.jsx               Privacy policy + terms
│   └── compose/                Composer: editor, toolbar, LinkedIn preview, scheduling
└── utils/connections.js        LinkedIn/X connection expiry helpers
```

## Design system

Colours are semantic tokens in `src/index.css` that flip between themes, exposed to Tailwind via `@theme inline`:

| Token (Tailwind) | Light | Dark |
| :--- | :--- | :--- |
| `bg-bg` | cream `#F4EDE0` | night `#050A16` |
| `text-ink` | navy `#14213D` | cream `#F6F1E7` |
| `bg-surface` | translucent cream (frosted) | translucent navy (frosted) |
| `bg-primary` / `text-on-primary` | navy / cream | cream / navy |
| `bg-accent` | coral `#FF6B5B` | coral `#FF6B5B` |

Plus `muted`, `line`, `success`, `warning`, `danger` and `info`. Use these instead of raw colours so both themes keep working.

Utilities defined in `index.css`:

- `card`, `card-hover`: frosted surface; lifts with a coral edge on hover
- `liquid-glass`, `glass-lens`: iOS-style glass capsules and the active-tab bubble
- `field`: text inputs
- `skeleton`, `link-draw`, `shine`, `bg-dots`, `prose-nexus`

The theme is stored in `localStorage` (`nexus-theme`: `light` / `dark` / `system`) and applied before first paint by a small script in `index.html`. The `dark:` variant follows `data-theme="dark"` on `<html>`.

**Motion:** shared presets live in `src/lib/motion.js`. Everything respects the OS "reduce motion" setting via `<MotionConfig reducedMotion="user">` and a CSS media query.

**Background:** `AppBackground` lazy-loads the Aero Shards WebGPU scene only when `navigator.gpu` exists (Chrome, Edge, Safari 26+). Other browsers get animated CSS glows. Shard colours per theme are set in `components/backgrounds/AppBackground.jsx`.

> Glass tip: `backdrop-filter` can't see through a parent that also uses `backdrop-filter`, `filter` or opacity below 1. Popovers inside glass (menus, editor pop-ups) are portalled to `<body>` or given a solid `bg-surface-solid`.

## Brand assets

`public/brand/` holds the mark and the full logo (light and dark), the app icon, PNG icons, and `og-image.png` for link previews. `public/favicon.svg` and `public/site.webmanifest` are wired up in `index.html`.

The in-app `<Logo />` draws from the same vectors (`src/lib/brand.js`), so it always matches the files. The wordmark is Fraunces (opsz 72, weight 800) converted to outlines.
