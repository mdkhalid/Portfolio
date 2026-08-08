# Portfolio — Design Reference

This file captures the visual design system, layout patterns, and styling conventions of the Portfolio app (Mohammad Khalid, Senior Solution Architect / Software Developer).

## 1. Theme System

- **Dark / Light toggle** managed by `ThemeContext` (`client/src/context/ThemeContext.jsx`).
- Initial theme resolved from `localStorage` (`theme` key), falling back to `prefers-color-scheme`.
- Root `<html>` gets `class="dark"` when dark mode is active; Tailwind uses the `dark:` variant to switch styles.
- All components read `dark` boolean from `useTheme()`.

## 2. Color Palette

### Brand accent gradient (primary signature)
- Linear gradient: `from-blue-600 via-cyan-500 to-emerald-500` — used for headings, gradient text, buttons, and highlights.
- Corresponding hover variant: `from-blue-700 via-cyan-600 to-emerald-600`.
- The accent system is blue → cyan → emerald across the whole app.

### Dark mode surfaces
- Page background: `bg-gray-900`, text `text-gray-100`.
- Cards: `bg-gray-800`, subtle borders `border-gray-700`.
- Glass cards: `bg-gray-900/60` with `backdrop-blur-xl` and a `border border-white/10`.

### Light mode surfaces
- Page background: `bg-gray-50`, text `text-gray-900`.
- Cards: `bg-white`, `shadow-lg`, subtle borders.

### Ambient background decorations
- "Glowing blobs": large blurred circles (`blur-3xl`) in blue / emerald / cyan behind the hero — animate with subtle Framer Motion float/pulse.
- Decorative grid or dot patterns (radial gradients) in hero/bento backgrounds.

## 3. Typography

- Font stack: Inter via Google Fonts (preconnected in `index.html`); monospace accent (e.g. `font-mono`) used for the logo and code/label elements.
- Headings: large display sizes with the brand gradient text (`bg-gradient-to-r ... bg-clip-text text-transparent`).
- Body: readable sizes (text-base/text-sm), `text-gray-300` on dark surfaces.
- Sizes scale responsively with `text-3xl md:text-4xl lg:text-5xl`-style patterns.

## 4. Logo

- `Logo` component (`client/src/components/Logo.jsx`): inline SVG of the initials "MK".
- Styled with the blue→cyan→emerald gradient fill and monospace font treatment.
- Appears in the navbar; links to home.

## 5. Layout & Navigation

### Classic layout (default theme)
- Top `Navbar`: sticky, backdrop-blur, border-bottom. Links: Home, Skills, Experience, Projects, Certifications, Blog, Postmortems, Resume, Chat, ATS Checker, Live Chat. Theme toggle + responsive hamburger menu.
- Single-column document flow: Hero → Summary → Skills → Experience → Projects → Certifications → Blog → Contact → Footer.

### Bento layout
- Full-bleed bento grid (`grid` with varying `col-span`/`row-span` tiles) — `BentoHome` component.
- Tiles feature glass cards, Specialty Carousel, LiveClock (Asia/Kolkata time), ProjectCard grid + detail modal, and a contact section.
- Selection persisted: stored in `localStorage` (`useBentoTheme`); server profile field `useBentoTheme` can override for the session.

## 6. Card & Component Styling Conventions

- Rounded corners: `rounded-xl` / `rounded-2xl`.
- Card base: `bg-white` (light) / `bg-gray-800` (dark), padding `p-4`–`p-8`.
- Glassmorphism: `bg-gray-900/60 backdrop-blur-xl border border-white/10` (bento tiles, chat, modal overlays).
- Section labels: uppercase, small, tracking-wide, `text-blue-400` (or gradient).
- Buttons: gradient filled (`bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500`) or outline (`border ... hover:bg-...`).
- Chips/tags: `bg-gray-700/50` pills with rounded-full.
- Hover effects: shadow + slight scale/translate transitions.

## 7. Motion & Animation (Framer Motion)

- `framer-motion` `motion.div` + `whileInView` reveal pattern for sections (fade/slide up with `viewport={{ once: true }}`).
- Hero: staggered entrance + floating gradient blobs.
- `AnimatePresence` used for modals (ProjectDetailModal, EditModal), toasts, and layout transitions.
- Navbar has a mobile menu drawer animation.
- `Layout` wraps routed pages with a fade-in transition.
- Scroll to top on route change (`ScrollToTop` component).

## 8. Icons

- `lucide-react` icon set throughout (e.g. `Mail`, `Github`, `Linkedin`, `ExternalLink`, `Calendar`, `MapPin`, `Menu`, `X`, `Moon`, `Sun`, `MessageCircle`, `FileText`, `AlertTriangle`, etc.).

## 9. Data Viz & Special Styling

### ATS Checker
- Circular score dial (`CircularScore`) — color by score:
  - ≥ 80 → emerald
  - ≥ 60 → blue
  - ≥ 40 → amber
  - below → red
- Keyword matches rendered as tag chips (green = matched, red/gray = missing).
- Section score bars (`ScoreBar`) with proportional fill.

### Postmortems
- Severity badges: SEV1 = red, SEV2 = orange, SEV3 = yellow.
- Status styles: resolved = green, mitigated = blue, monitoring = amber, ongoing = red.
- Timeline rendered as vertical list with time dots; action items as checklist with priority tags (P0/P1/P2) and status (done/in_progress/todo).

### Blog / Markdown
- `react-markdown` renders article/postmortem content with custom styling.
- `MermaidDiagram` component renders Mermaid flow/sequence diagrams inside markdown (theme-aware).
- Reading-time estimate shown on cards.

## 10. Charts & Analytics (Admin)

- Admin analytics use lightweight chart components (bar/line/donut) built with SVG/CSS — no heavy chart library.
- Consistent color coding: primary gradient for series, gray for baselines.

## 11. Responsiveness

- Mobile-first Tailwind utilities (`sm:`, `md:`, `lg:`, `xl:`).
- Navbar collapses to hamburger drawer.
- Bento grid collapses to single column.
- Chat/ATS admin panels stack on mobile.

## 12. Accessibility & UX

- Semantic HTML sections with ids for nav anchors.
- `aria-label`s on icon-only buttons.
- Cookie consent banner (`CookieConsent`) with accept/decline — analytics only after consent.
- Toast notifications for feedback (admin CRUD, chat, contact forms).
