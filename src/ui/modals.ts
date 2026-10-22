// The registry of open modal ids (SCN-08, UI-SPEC Overlay mechanics). A modal holds its id while it
// is mounted; the clock driver reads anyModalOpen and does not advance the run while one is open.

import { computed, signal } from '@preact/signals';

const open = signal<ReadonlySet<string>>(new Set());

export function holdModal(id: string): void {
  if (open.peek().has(id)) return;
  open.value = new Set([...open.peek(), id]);
}

export function releaseModal(id: string): void {
  if (!open.peek().has(id)) return;
  const next = new Set(open.peek());
  next.delete(id);
  open.value = next;
}

/** True while at least one modal id is held. */
export const anyModalOpen = computed(() => open.value.size > 0);
