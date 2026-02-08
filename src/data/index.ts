import { whatsapp } from './whatsapp';
import { instagram } from './instagram';
import { telegram } from './telegram';
import { netflix } from './netflix';
import { uber } from './uber';
import { twitter } from './twitter';
import type { SystemDesign, Category } from './types';

export type { SystemDesign, Category };
export { categoryLabels, categoryColors } from './types';

export const systems: SystemDesign[] = [
  whatsapp,
  instagram,
  telegram,
  netflix,
  uber,
  twitter,
];

export function getSystemBySlug(slug: string): SystemDesign | undefined {
  return systems.find((s) => s.slug === slug);
}

export function getSystemsByCategory(category: Category): SystemDesign[] {
  return systems.filter((s) => s.category === category);
}

export function getAllCategories(): Category[] {
  return [...new Set(systems.map((s) => s.category))];
}

export function getAllTags(): string[] {
  return [...new Set(systems.flatMap((s) => s.tags))].sort();
}
