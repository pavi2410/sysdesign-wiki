# SysDesign.Wiki

An open encyclopedia of system design and architecture for popular apps and services. Learn how WhatsApp, Instagram, Netflix, Uber, Telegram, and Twitter are built — then copy an AI-ready prompt to build your own.

**Live at [sysdesign.wiki](https://sysdesign.wiki)**

## Features

- **6 in-depth system design articles** — WhatsApp, Instagram, Telegram, Netflix, Uber, Twitter/X
- **Interactive Mermaid diagrams** — architecture overviews, sequence diagrams, ER models with custom theming
- **"Copy as Prompt" button** — generates a detailed architecture prompt for AI coding assistants to help you build your own clone
- **SEO-optimized** — OpenGraph images (dynamic PNG per article via Satori), JSON-LD structured data, sitemap, Twitter Cards
- **Modern minimal UI** — elegant serif typography (Playfair Display), warm paper palette, wiki-style layout

## Tech Stack

- **[Astro](https://astro.build)** — static site framework
- **[Tailwind CSS v4](https://tailwindcss.com)** — CSS-first configuration with `@theme`
- **[Mermaid.js](https://mermaid.js.org)** — architecture and data model diagrams
- **[Satori](https://github.com/vercel/satori) + [@resvg/resvg-js](https://github.com/nicolo-ribaudo/resvg-js)** — dynamic OG image generation at build time
- **[Cloudflare Workers](https://workers.cloudflare.com)** — deployment target
- **[Bun](https://bun.sh)** — package manager and runtime

## Project Structure

```text
src/
├── components/          # Astro components (Nav, MermaidDiagram, CopyPromptButton, etc.)
├── data/                # System design content (one file per system + shared types)
├── layouts/             # BaseLayout with full SEO meta tags
├── lib/                 # Prompt generator utility
├── pages/
│   ├── index.astro      # Home page
│   ├── catalog.astro    # Filterable catalog
│   ├── about.astro      # About page
│   ├── systems/[slug].astro  # Dynamic article pages
│   └── og/              # Dynamic OG image endpoints (PNG)
└── styles/global.css    # Tailwind v4 theme configuration
```

## Getting Started

```bash
bun install
bun run dev        # http://localhost:4321
```

## Commands

| Command            | Action                                    |
| :----------------- | :---------------------------------------- |
| `bun install`      | Install dependencies                      |
| `bun run dev`      | Start dev server at `localhost:4321`      |
| `bun run build`    | Build for production                      |
| `bun run preview`  | Preview production build locally          |

## Deployment

Deployed to **Cloudflare Workers** via `wrangler`. The Astro Cloudflare adapter is pre-configured.

```bash
bun run build
bunx wrangler deploy
```

## License

MIT
