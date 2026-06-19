/**
 * Reading Store — client-side only, backed by localStorage.
 *
 * Two stores:
 *   sysdesign:read  — pages the user has finished reading
 *   sysdesign:list  — pages saved for later
 *
 * Both store full item metadata so the /reading-list page
 * can render without any server round-trips.
 */

export interface ReadingItem {
  id: string;      // e.g. "lessons/caching"
  title: string;
  tagline: string;
  href: string;
  type: 'lesson' | 'guide' | 'system';
  timestamp: number;
}

const READ_KEY = 'sysdesign:read';
const LIST_KEY = 'sysdesign:list';

function load(key: string): ReadingItem[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    return [];
  }
}

function save(key: string, items: ReadingItem[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function emit(detail: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent('readingStateChange', { detail }));
}

// ── Read ─────────────────────────────────────────────────────────────────────

export function isRead(id: string): boolean {
  return load(READ_KEY).some((item) => item.id === id);
}

export function markRead(item: Omit<ReadingItem, 'timestamp'>): void {
  const items = load(READ_KEY).filter((i) => i.id !== item.id);
  items.unshift({ ...item, timestamp: Date.now() });
  save(READ_KEY, items);
  // Reading something implies you no longer need it in the list
  removeFromList(item.id);
  emit({ type: 'read', id: item.id, value: true });
}

export function unmarkRead(id: string): void {
  save(READ_KEY, load(READ_KEY).filter((i) => i.id !== id));
  emit({ type: 'read', id, value: false });
}

export function toggleRead(item: Omit<ReadingItem, 'timestamp'>): boolean {
  if (isRead(item.id)) {
    unmarkRead(item.id);
    return false;
  } else {
    markRead(item);
    return true;
  }
}

export function getRead(): ReadingItem[] {
  return load(READ_KEY);
}

// ── Reading List ─────────────────────────────────────────────────────────────

export function inList(id: string): boolean {
  return load(LIST_KEY).some((item) => item.id === id);
}

export function addToList(item: Omit<ReadingItem, 'timestamp'>): void {
  if (isRead(item.id)) return; // already read, no need to save
  const items = load(LIST_KEY).filter((i) => i.id !== item.id);
  items.unshift({ ...item, timestamp: Date.now() });
  save(LIST_KEY, items);
  emit({ type: 'list', id: item.id, value: true });
}

export function removeFromList(id: string): void {
  save(LIST_KEY, load(LIST_KEY).filter((i) => i.id !== id));
  emit({ type: 'list', id, value: false });
}

export function toggleList(item: Omit<ReadingItem, 'timestamp'>): boolean {
  if (inList(item.id)) {
    removeFromList(item.id);
    return false;
  } else {
    addToList(item);
    return true;
  }
}

export function getList(): ReadingItem[] {
  return load(LIST_KEY);
}

export function getListCount(): number {
  return load(LIST_KEY).length;
}
