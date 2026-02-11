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
