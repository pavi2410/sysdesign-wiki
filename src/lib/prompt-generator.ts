import type { SystemDesign } from '../data/types';

export function generateBuildPrompt(system: SystemDesign): string {
  const scaleLines = Object.entries(system.scale)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const funcReqs = system.requirements.functional
    .map((r) => `- ${r}`)
    .join('\n');

  const nonFuncReqs = system.requirements.nonFunctional
    .map((r) => `- ${r}`)
    .join('\n');

  const components = system.components
    .map((c) => `### ${c.name}\n${c.description}`)
    .join('\n\n');

  const deepDives = system.deepDive
    .map((d) => `### ${d.title}\n${d.content}`)
    .join('\n\n');

  const tradeoffs = system.tradeoffs
    .map(
      (t) =>
        `### ${t.decision}\n**Pros:** ${t.pros.join('; ')}\n**Cons:** ${t.cons.join('; ')}`
    )
    .join('\n\n');

  return `# Build a ${system.name}-like System

You are an expert software architect. I want to build a production-grade application inspired by ${system.name} (${system.tagline}).

Use the following system design reference to guide the architecture, tech choices, and implementation. Adapt it to my specific needs while preserving the key architectural patterns that make this system work at scale.

---

## Overview
${system.overview}

## Target Scale
${scaleLines}

## Functional Requirements
${funcReqs}

## Non-Functional Requirements
${nonFuncReqs}

## Architecture Components
${components}

## Data Model (Mermaid ER Diagram)
\`\`\`mermaid
${system.dataModel}
\`\`\`

## Key Architectural Deep Dives
${deepDives}

## Tradeoffs to Consider
${tradeoffs}

---

## Instructions

Based on the architecture above, please:

1. **Choose a modern tech stack** appropriate for my team size and scale targets. Justify each choice.
2. **Design the database schema** with proper indexes, partitioning strategy, and replication approach.
3. **Implement the core services** starting with the most critical path (e.g., message delivery for messaging, feed generation for social).
4. **Set up the infrastructure** with containerization, CI/CD, monitoring, and observability.
5. **Plan for scale** — identify the components that will need horizontal scaling first and design them to be stateless where possible.

Start by asking me clarifying questions about my specific requirements, team size, budget, and timeline. Then produce a phased implementation plan.
`;
}
