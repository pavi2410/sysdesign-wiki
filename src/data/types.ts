export interface SystemDesign {
  slug: string;
  name: string;
  tagline: string;
  category: Category;
  tags: string[];
  overview: string;
  scale: Record<string, string>;
  requirements: { functional: string[]; nonFunctional: string[] };
  highLevelDiagram: string;
  components: { name: string; description: string }[];
  dataModel: string;
  deepDive: { title: string; content: string; diagram?: string }[];
  tradeoffs: { decision: string; pros: string[]; cons: string[] }[];
}

export type Category = 'messaging' | 'social' | 'streaming' | 'transport' | 'search' | 'commerce' | 'infra' | 'video' | 'devtools' | 'ai' | 'productivity';

export const categoryLabels: Record<Category, string> = {
  messaging: 'Messaging', social: 'Social Media', streaming: 'Streaming',
  transport: 'Transportation', search: 'Search & Discovery',
  commerce: 'E-Commerce', infra: 'Infrastructure',
  video: 'Video & Conferencing', devtools: 'Developer Tools',
  ai: 'AI & ML', productivity: 'Productivity',
};

export const categoryColors: Record<Category, string> = {
  messaging: 'bg-cat-messaging', social: 'bg-cat-social', streaming: 'bg-cat-streaming',
  transport: 'bg-cat-transport', search: 'bg-cat-search',
  commerce: 'bg-cat-commerce', infra: 'bg-cat-infra',
  video: 'bg-cat-video', devtools: 'bg-cat-devtools',
  ai: 'bg-cat-ai', productivity: 'bg-cat-productivity',
};
