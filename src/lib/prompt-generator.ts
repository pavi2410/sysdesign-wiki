// Legacy types kept for reference — old functions below are unused after MDX migration
type SystemDesign = {
  name: string; tagline: string; category: string; overview: string;
  scale: Record<string, string>;
  requirements: { functional: string[]; nonFunctional: string[] };
  components: { name: string; description: string }[];
  dataModel: string;
  deepDive: { title: string; content: string }[];
  tradeoffs: { decision: string; pros: string[]; cons: string[] }[];
};
type FeatureGuide = {
  title: string; tagline: string; category: string; problem: string;
  approaches: { name: string; description: string; pros: string[]; cons: string[] }[];
  components: { name: string; description: string }[];
  dataModel: string;
  deepDive: { title: string; content: string }[];
  realWorldExamples: { system: string; approach: string }[];
  tradeoffs: { decision: string; pros: string[]; cons: string[] }[];
};

export function generateBuildPromptFromMdx(entry: { data: { name: string; tagline: string }; body?: string }): string {
  const { name, tagline } = entry.data;
  const body = entry.body ?? '';

  return `# Build a ${name}-like System

You are an expert software architect. I want to build a production-grade application inspired by ${name} (${tagline}).

Use the following system design reference to guide the architecture, tech choices, and implementation. Adapt it to my specific needs while preserving the key architectural patterns that make this system work at scale.

---

## System Design Reference
${body}

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

export function generateGuidePromptFromMdx(entry: { data: { title: string; tagline: string }; body?: string }): string {
  const { title, tagline } = entry.data;
  const body = entry.body ?? '';

  return `# How to Build: ${title}

You are an expert software architect. I want to implement ${title.toLowerCase()} in my application. (${tagline}).

Use the following architectural guide to inform the design. Adapt it to my specific needs while preserving the key patterns.

---

${body}

---

## Instructions

Based on the architecture above, please:

1. **Recommend an approach** best suited for my scale, team, and constraints. Justify the choice.
2. **Design the data model** with proper indexes, partitioning, and storage strategy.
3. **Implement the core logic** with production-ready error handling and edge cases.
4. **Plan for scale** — identify bottlenecks and design for horizontal scaling.
5. **Add observability** — logging, metrics, and alerting for this feature.

Start by asking me clarifying questions about my specific requirements, existing tech stack, and scale targets. Then produce a phased implementation plan.
`;
}

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

export function generateGuidePrompt(guide: FeatureGuide): string {
  const approaches = guide.approaches
    .map(
      (a, i) =>
        `### Approach ${i + 1}: ${a.name}\n${a.description}\n**Pros:** ${a.pros.join('; ')}\n**Cons:** ${a.cons.join('; ')}`
    )
    .join('\n\n');

  const components = guide.components
    .map((c) => `### ${c.name}\n${c.description}`)
    .join('\n\n');

  const deepDives = guide.deepDive
    .map((d) => `### ${d.title}\n${d.content}`)
    .join('\n\n');

  const examples = guide.realWorldExamples
    .map((e) => `- **${e.system}**: ${e.approach}`)
    .join('\n');

  const tradeoffs = guide.tradeoffs
    .map(
      (t) =>
        `### ${t.decision}\n**Pros:** ${t.pros.join('; ')}\n**Cons:** ${t.cons.join('; ')}`
    )
    .join('\n\n');

  return `# How to Build: ${guide.title}

You are an expert software architect. I want to implement ${guide.title.toLowerCase()} in my application. (${guide.tagline}).

Use the following architectural guide to inform the design. Adapt it to my specific needs while preserving the key patterns.

---

## Problem
${guide.problem}

## Architectural Approaches
${approaches}

## Key Components
${components}

## Data Model (Mermaid ER Diagram)
\`\`\`mermaid
${guide.dataModel}
\`\`\`

## Deep Dives
${deepDives}

## Real-World Examples
${examples}

## Tradeoffs
${tradeoffs}

---

## Instructions

Based on the architecture above, please:

1. **Recommend an approach** best suited for my scale, team, and constraints. Justify the choice.
2. **Design the data model** with proper indexes, partitioning, and storage strategy.
3. **Implement the core logic** with production-ready error handling and edge cases.
4. **Plan for scale** — identify bottlenecks and design for horizontal scaling.
5. **Add observability** — logging, metrics, and alerting for this feature.

Start by asking me clarifying questions about my specific requirements, existing tech stack, and scale targets. Then produce a phased implementation plan.
`;
}
