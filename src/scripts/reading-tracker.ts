/**
 * reading-tracker.ts
 *
 * Loaded globally (via BaseLayout). Responsible for:
 *   1. Injecting read/saved badges on every [data-content-id] card
 *   2. Keeping the nav reading-list count badge up to date
 *   3. Re-running on readingStateChange events (same-tab)
 *   4. Re-running on storage events (cross-tab sync)
 */

import { isRead, inList, getListCount } from '@/scripts/reading-store';

// ── Badge markup ──────────────────────────────────────────────────────────────

function makeReadBadge(): HTMLElement {
  const el = document.createElement('span');
  el.className =
    'reading-indicator pointer-events-none absolute top-2.5 right-2.5 z-10 ' +
    'w-5 h-5 rounded-full bg-accent flex items-center justify-center ' +
    'shadow-[1px_1px_3px_rgba(37,99,235,0.5),-1px_-1px_2px_rgba(255,255,255,0.1)]';
  el.setAttribute('aria-label', 'Read');
  el.innerHTML =
    '<svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 6 9 17l-5-5"/></svg>';
  return el;
}

function makeListBadge(): HTMLElement {
  const el = document.createElement('span');
  el.className =
    'reading-indicator pointer-events-none absolute top-2.5 right-2.5 z-10 ' +
    'w-5 h-5 rounded-full bg-paper border border-accent flex items-center justify-center ' +
    'shadow-[1px_1px_3px_rgba(24,24,27,0.08),-1px_-1px_2px_rgba(255,255,255,0.8)]';
  el.setAttribute('aria-label', 'Saved for later');
  el.innerHTML =
    '<svg class="w-2.5 h-2.5 text-accent" viewBox="0 0 24 24" fill="currentColor" stroke="none">' +
    '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  return el;
}

// ── Card indicator update ─────────────────────────────────────────────────────

function updateCard(el: Element, id: string): void {
  el.querySelectorAll('.reading-indicator').forEach((b) => b.remove());
  if (isRead(id)) {
    el.appendChild(makeReadBadge());
  } else if (inList(id)) {
    el.appendChild(makeListBadge());
  }
}

function updateAllCards(): void {
  document.querySelectorAll<HTMLElement>('[data-content-id]').forEach((el) => {
    const id = el.dataset.contentId;
    if (id) updateCard(el, id);
  });
}

// ── Nav badge ─────────────────────────────────────────────────────────────────

function updateNavBadge(): void {
  const badge = document.getElementById('reading-list-count');
  if (!badge) return;
  const count = getListCount();
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
}

// ── Init & reactivity ─────────────────────────────────────────────────────────

function init(): void {
  updateAllCards();
  updateNavBadge();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Same-tab reactivity: state changed by ReadingActions buttons
window.addEventListener('readingStateChange', (e: Event) => {
  const { id } = (e as CustomEvent<{ id: string }>).detail;
  // Update the specific card if visible on this page
  document.querySelectorAll<HTMLElement>(`[data-content-id="${id}"]`).forEach((el) => {
    updateCard(el, id);
  });
  updateNavBadge();
});

// Cross-tab sync: another tab changed localStorage
window.addEventListener('storage', (e: StorageEvent) => {
  if (e.key === 'sysdesign:read' || e.key === 'sysdesign:list') {
    updateAllCards();
    updateNavBadge();
  }
});
