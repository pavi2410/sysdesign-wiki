# SysDesign.Wiki

Practical system design learning for engineers who want stronger architecture judgment. SysDesign Wiki focuses on concepts, capability guides, case studies, tradeoffs, cost drivers, cloud constraints, failure modes, and 0 to 1 design thinking.

**Live at [sysdesign.wiki](https://sysdesign.wiki)**

## Philosophy

This is not interview prep, hyperscale cosplay, or a content farm. The goal is to help engineers understand how systems are shaped by constraints so they can ask better questions in real projects.

- **Capabilities** - learn common product capabilities like webhooks, rate limiting, file uploads, search, audit logs, and feature flags.
- **Concepts** - study building blocks like queues, caches, backpressure, object storage, observability, and consistency.
- **Case studies** - use popular-system-inspired pages as learning models, not exact private production diagrams.
- **Learning context prompts** - copy assumption-aware prompts for AI assistants that emphasize tradeoffs, costs, failure modes, and measurement plans.

## Tech Stack

- **[Astro](https://astro.build)** - static site framework
- **[Tailwind CSS v4](https://tailwindcss.com)** - CSS-first configuration with `@theme`
- **[Mermaid.js](https://mermaid.js.org)** - architecture and data model diagrams
- **[Satori](https://github.com/vercel/satori) + [@resvg/resvg-js](https://github.com/nicolo-ribaudo/resvg-js)** - dynamic OG image generation at build time
- **[Cloudflare Workers](https://workers.cloudflare.com)** - deployment target
- **[Bun](https://bun.sh)** - package manager and runtime

## Project Structure

```text
src/
├── components/
├── content/
│   ├── guides/      # Capability guides
│   ├── lessons/     # Concepts
│   └── systems/     # Case studies
├── layouts/
├── lib/
├── pages/
└── styles/
```

## Getting Started

```bash
bun install
bun run dev
```

## Commands

| Command | Action |
| :-- | :-- |
| `bun run dev` | Start dev server at `localhost:4321` |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build locally |

## License

MIT
