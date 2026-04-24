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

  return `# Learn From a ${name}-like System

You are an expert software architect and teacher. I want to learn from a ${name}-inspired system design (${tagline}) without pretending this is the exact private production architecture.

Use the following reference as a learning model. Keep assumptions visible, avoid unsupported scale claims, and explain the engineering forces behind each design choice.

---

## System Design Reference
${body}

---

## Instructions

Based on the architecture above, please:

1. **State the assumptions** behind the design and call out what is inferred or unknown.
2. **Explain the 0->1 starting design** a small team could learn from without over-engineering.
3. **Identify tradeoffs and cost drivers** including storage, egress, compute, queues, indexing, and observability where relevant.
4. **Name the likely failure modes** and the signals that would reveal them.
5. **Describe evolution paths** only as conditional breakpoints, not universal prescriptions.

Start by asking clarifying questions about my learning goal, team context, cloud provider, budget sensitivity, and scale assumptions. Then produce an assumption-bound explanation and decision checklist.
`;
}

export function generateGuidePromptFromMdx(entry: { data: { title: string; tagline: string }; body?: string }): string {
  const { title, tagline } = entry.data;
  const body = entry.body ?? '';

  return `# Learn the System Design of: ${title}

You are an expert software architect and teacher. I want to understand ${title.toLowerCase()} as a practical system design capability. (${tagline}).

Use the following architectural guide as a learning reference. Avoid one-size-fits-all recommendations. Keep assumptions, costs, and tradeoffs explicit.

---

${body}

---

## Instructions

Based on the architecture above, please:

1. **State the assumptions** and what would change if the team, scale, or cloud provider changed.
2. **Explain the 0->1 design** and why it is a reasonable starting point.
3. **Compare the key tradeoffs** without claiming a universal best answer.
4. **Identify cost drivers and failure modes** that teams should understand early.
5. **List the measurements and breakpoints** that would justify evolving the design.

Start by asking clarifying questions about my context. Then produce an assumption-bound learning summary, decision checklist, and measurement plan.
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

  return `# Learn From a ${system.name}-like System

You are an expert software architect and teacher. I want to learn from a ${system.name}-inspired system design (${system.tagline}) without pretending this is the exact private production architecture.

Use the following reference as a learning model. Keep assumptions visible, avoid unsupported scale claims, and explain the engineering forces behind each design choice.

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

1. **State the assumptions** behind the design and call out what is inferred or unknown.
2. **Explain the 0->1 starting design** a small team could learn from without over-engineering.
3. **Identify tradeoffs and cost drivers** including storage, egress, compute, queues, indexing, and observability where relevant.
4. **Name the likely failure modes** and the signals that would reveal them.
5. **Describe evolution paths** only as conditional breakpoints, not universal prescriptions.

Start by asking clarifying questions about my learning goal, team context, cloud provider, budget sensitivity, and scale assumptions. Then produce an assumption-bound explanation and decision checklist.
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

  return `# Learn the System Design of: ${guide.title}

You are an expert software architect and teacher. I want to understand ${guide.title.toLowerCase()} as a practical system design capability. (${guide.tagline}).

Use the following architectural guide as a learning reference. Avoid one-size-fits-all recommendations. Keep assumptions, costs, and tradeoffs explicit.

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

1. **State the assumptions** and what would change if the team, scale, or cloud provider changed.
2. **Explain the 0->1 design** and why it is a reasonable starting point.
3. **Compare the key tradeoffs** without claiming a universal best answer.
4. **Identify cost drivers and failure modes** that teams should understand early.
5. **List the measurements and breakpoints** that would justify evolving the design.

Start by asking clarifying questions about my context. Then produce an assumption-bound learning summary, decision checklist, and measurement plan.
`;
}
