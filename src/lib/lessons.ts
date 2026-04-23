import type { CollectionEntry } from 'astro:content';

type Lesson = CollectionEntry<'lessons'>;
type Guide = CollectionEntry<'guides'>;
type System = CollectionEntry<'systems'>;

export const learningPaths = [
  {
    title: 'System Design Foundations',
    tagline: 'The vocabulary and mental models behind every architecture diagram.',
    lessonIds: ['load-balancer', 'api-gateway', 'message-queue', 'object-storage', 'idempotency'],
  },
  {
    title: 'Data & Storage Basics',
    tagline: 'How systems store, find, copy, and keep data consistent.',
    lessonIds: ['cache-aside', 'write-through-cache', 'sharding', 'replication', 'search-index', 'bloom-filter'],
  },
  {
    title: 'Real-Time Systems',
    tagline: 'Patterns for low-latency messaging, collaboration, and live updates.',
    lessonIds: ['websocket', 'pub-sub', 'backpressure', 'crdt', 'operational-transform'],
  },
  {
    title: 'Reliability & Scaling',
    tagline: 'The tools that keep distributed systems available under stress.',
    lessonIds: ['rate-limiting', 'circuit-breaker', 'retry-exponential-backoff', 'eventual-consistency', 'strong-consistency'],
  },
  {
    title: 'Security Architecture',
    tagline: 'Core protocols and controls for identity, privacy, and transport safety.',
    lessonIds: ['oauth2-authorization-code-flow', 'jwt', 'tls'],
  },
  {
    title: 'AI Infrastructure',
    tagline: 'The building blocks behind modern LLM and retrieval systems.',
    lessonIds: ['gpu-inference', 'embeddings', 'vector-database'],
  },
];

function overlapCount(left: string[], right: string[]) {
  const rightSet = new Set(right.map((item) => item.toLowerCase()));
  return left.reduce((count, item) => count + (rightSet.has(item.toLowerCase()) ? 1 : 0), 0);
}

export function getLessonsForGuide(lessons: Lesson[], guide: Guide, limit = 4) {
  return lessons
    .map((lesson) => ({
      lesson,
      score:
        (lesson.data.relatedGuides.includes(guide.id) ? 100 : 0) +
        overlapCount(lesson.data.tags, guide.data.tags),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.lesson.data.title.localeCompare(b.lesson.data.title))
    .slice(0, limit)
    .map((item) => item.lesson);
}

export function getLessonsForSystem(lessons: Lesson[], system: System, limit = 4) {
  return lessons
    .map((lesson) => ({
      lesson,
      score:
        (lesson.data.relatedSystems.includes(system.id) ? 100 : 0) +
        overlapCount(lesson.data.tags, system.data.tags),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.lesson.data.title.localeCompare(b.lesson.data.title))
    .slice(0, limit)
    .map((item) => item.lesson);
}
