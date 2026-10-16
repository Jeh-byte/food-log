// Hands a meal to the confirm screen. Kept in memory because route params are strings.
import type { Entry } from './nutrition';

export type Draft = Omit<Entry, 'id'> & {
  id: string | null; // null for a new entry
  notes?: string;
  confidence?: 'low' | 'medium' | 'high';
};

let current: Draft | null = null;

export const setDraft = (d: Draft) => {
  current = d;
};
export const takeDraft = () => current;
export const clearDraft = () => {
  current = null;
};
