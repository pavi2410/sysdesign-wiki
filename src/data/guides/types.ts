export interface FeatureGuide {
  slug: string;
  title: string;
  tagline: string;
  category: GuideCategory;
  tags: string[];
  problem: string;
  approaches: {
    name: string;
    description: string;
    pros: string[];
    cons: string[];
  }[];
  architectureDiagram: string;
  components: { name: string; description: string }[];
  dataModel: string;
  deepDive: { title: string; content: string; diagram?: string }[];
  realWorldExamples: { system: string; approach: string }[];
  tradeoffs: { decision: string; pros: string[]; cons: string[] }[];
}

export type GuideCategory = 'real-time' | 'platform' | 'data' | 'reliability' | 'security' | 'media' | 'collaboration';

export const guideCategoryLabels: Record<GuideCategory, string> = {
  'real-time': 'Real-Time & Communication',
  platform: 'SaaS Platform',
  data: 'Data & Search',
  reliability: 'Reliability & Infra',
  security: 'Security & Payments',
  media: 'Media & Files',
  collaboration: 'Collaboration & UX',
};

export const guideCategoryColors: Record<GuideCategory, string> = {
  'real-time': 'bg-gcat-realtime',
  platform: 'bg-gcat-platform',
  data: 'bg-gcat-data',
  reliability: 'bg-gcat-reliability',
  security: 'bg-gcat-security',
  media: 'bg-gcat-media',
  collaboration: 'bg-gcat-collaboration',
};
