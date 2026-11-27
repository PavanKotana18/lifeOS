
import { isNoteObject, noteIdPattern, parseNoteDocument, type NoteDocument } from './notesDocument';

export const NOTES_EPOCH_KEY = 'notesWorkspaceEpoch';
export const NOTES_VIEW_KEY = 'notesWorkspaceView';
export const noteLinkTables = { task: 'tasks', habit: 'habits', goal: 'goals', transaction: 'transactions' } as const;

export type NoteLinkKind = keyof typeof noteLinkTables;
export interface NoteLink { kind: NoteLinkKind; id: string }
export interface NoteReminder { id: string; at: string }

export interface NoteDraft {
  id: string;
  title: string;
  document: NoteDocument;
  notebookId?: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  reminder?: NoteReminder;
  links: NoteLink[];
}

export interface NoteRecord extends NoteDraft {
  createdAt: string;
  updatedAt: string;
  revision: number;
  trashedAt?: string;
}

export interface Notebook {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export function normalizeNoteLabel(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

export function normalizeNoteTags(tags: string[]): string[] {
  const unique = new Map<string, string>();
  for (const tag of tags) {
    const label = normalizeNoteLabel(tag);
    if (label && !unique.has(label.toLowerCase())) unique.set(label.toLowerCase(), label);
  }
  return Array.from(unique.values());
}

function validateId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !noteIdPattern.test(id)) throw new Error('Invalid Notes record identifier.');
}

function validateTimestamp(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error('Invalid Notes timestamp.');
  }
}

function validateRevision(value: Record<string, unknown>) {
  validateId(value.id);
  validateTimestamp(value.createdAt);
  validateTimestamp(value.updatedAt);
  if (value.updatedAt < value.createdAt || typeof value.revision !== 'number' ||
      !Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error('Invalid Notes revision.');
}

const noteFields = new Set([
  'id', 'title', 'document', 'notebookId', 'tags', 'pinned', 'archived', 'reminder',
  'links', 'createdAt', 'updatedAt', 'revision', 'trashedAt',
]);

export function validateNoteRecord(value: unknown): asserts value is NoteRecord {
  if (!isNoteObject(value) || Object.keys(value).some(key => !noteFields.has(key)) ||
      typeof value.title !== 'string' || value.title.length > 240 ||
      typeof value.pinned !== 'boolean' || typeof value.archived !== 'boolean') throw new Error('Invalid note.');
  validateRevision(value);
  parseNoteDocument(value.document);
  if (value.notebookId !== undefined) validateId(value.notebookId);
  const { tags } = value;
  if (!Array.isArray(tags) || tags.length > 20 ||
      tags.some(tag => typeof tag !== 'string' || tag.length > 48 || !tag || normalizeNoteLabel(tag) !== tag) ||
      new Set(tags.map(tag => tag.toLowerCase())).size !== tags.length) throw new Error('Invalid note tags.');
  if (!Array.isArray(value.links) || value.links.length > 50) throw new Error('Invalid note links.');
  const linkIds = new Set<string>();
  for (const link of value.links) {
    if (!isNoteObject(link) || Object.keys(link).length !== 2 || typeof link.kind !== 'string' ||
        !Object.prototype.hasOwnProperty.call(noteLinkTables, link.kind)) throw new Error('Invalid note link.');
    validateId(link.id);
    const key = link.kind + ':' + link.id;
    if (linkIds.has(key)) throw new Error('Duplicate note link.');
    linkIds.add(key);
  }
  if (value.trashedAt !== undefined) {
    validateTimestamp(value.trashedAt);
    if (value.trashedAt < (value.createdAt as string) || value.trashedAt > (value.updatedAt as string) ||
        value.reminder !== undefined) throw new Error('Invalid trashed note.');
  }
  if (value.reminder !== undefined) {
    if (value.archived || !isNoteObject(value.reminder) || Object.keys(value.reminder).length !== 2) {
      throw new Error('Invalid note reminder.');
    }
    validateId(value.reminder.id);
    if (value.reminder.id.length > 80) throw new Error('Invalid reminder identifier.');
    validateTimestamp(value.reminder.at);
  }
}

export function validateNotebook(value: unknown): asserts value is Notebook {
  const fields = ['id', 'name', 'createdAt', 'updatedAt', 'revision'];
  if (!isNoteObject(value) || Object.keys(value).some(key => !fields.includes(key)) ||
      typeof value.name !== 'string' || !value.name || value.name.length > 96 ||
      value.name !== normalizeNoteLabel(value.name)) throw new Error('Invalid notebook.');
  validateRevision(value);
}

export function validateNotesBackup(tables: Record<string, unknown>) {
  const notebooks = 'notebooks' in tables ? tables.notebooks : [];
  const notes = 'notes' in tables ? tables.notes : [];
  if (!Array.isArray(notebooks) || !Array.isArray(notes)) throw new Error('Invalid Notes backup tables.');
  const ids = new Set<string>();
  for (const notebook of notebooks) {
    validateNotebook(notebook);
    if (ids.has(notebook.id)) throw new Error('Duplicate notebook.');
    ids.add(notebook.id);
  }
  const noteIds = new Set<string>();
  for (const note of notes) {
    validateNoteRecord(note);
    if (noteIds.has(note.id)) throw new Error('Duplicate note.');
    noteIds.add(note.id);
    if (note.notebookId && !ids.has(note.notebookId)) throw new Error('A note refers to a missing notebook.');
  }
}
