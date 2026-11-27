
import type { EncryptedWriteContext } from './encryptedTransactionCoordinator';
import {
  NOTES_EPOCH_KEY, NOTES_VIEW_KEY, normalizeNoteLabel, normalizeNoteTags, noteLinkTables,
  validateNotebook, validateNoteRecord, type NoteDraft, type NoteRecord, type Notebook
} from './notesDomain';
import { notePreview } from './notesDocument';

interface NotesTransaction {
  run<T>(operation: (context: EncryptedWriteContext) => Promise<T>): Promise<T>;
}

interface Setting { key: string; value: unknown }
export type NotesView = 'list' | 'grid';
export type NoteDisposition = 'trash' | 'restore' | 'delete';

export interface NotesWorkspaceData {
  notes: NoteRecord[];
  notebooks: Notebook[];
  epoch: string;
  view: NotesView;
}

export interface NotesStorage {
  workspace(): Promise<NotesWorkspaceData>;
  save(epoch: string, expectedRevision: number | null, draft: NoteDraft): Promise<NoteRecord | null>;
  dispose(epoch: string, id: string, revision: number, action: NoteDisposition): Promise<void>;
  saveNotebook(epoch: string, key: { id: string; revision: number } | null, name: string): Promise<Notebook>;
  removeNotebook(epoch: string, id: string, revision: number): Promise<void>;
  setView(epoch: string, view: NotesView): Promise<void>;
}

function epochOf(setting: Setting | undefined): string {
  return typeof setting?.value === 'string' ? setting.value : '';
}

async function assertEpoch(context: EncryptedWriteContext, epoch: string) {
  if (epochOf(await context.get<Setting>('settings', NOTES_EPOCH_KEY)) !== epoch) {
    throw new Error('The workspace changed. Reopen Notes to continue.');
  }
}

function assertRevision(record: { revision: number } | undefined, revision: number | null) {
  if ((record?.revision ?? null) !== revision) {
    throw new Error('This record changed. Reopen it before making more edits.');
  }
}

function updatedAt(record?: { updatedAt: string }, now = new Date().toISOString()) {
  return record && record.updatedAt > now ? record.updatedAt : now;
}

export function createEncryptedNotes(
  transaction: NotesTransaction
): NotesStorage {
  return {
    workspace: () => transaction.run(async context => {
      const [notes, notebooks, epoch, view] = await Promise.all([
        context.getAll<NoteRecord>('notes'), context.getAll<Notebook>('notebooks'),
        context.get<Setting>('settings', NOTES_EPOCH_KEY), context.get<Setting>('settings', NOTES_VIEW_KEY),
      ]);
      return { notes, notebooks, epoch: epochOf(epoch), view: view?.value === 'grid' ? 'grid' : 'list' };
    }),
    save: (epoch, expectedRevision, draft) => transaction.run(async context => {
      await assertEpoch(context, epoch);
      const current = await context.get<NoteRecord>('notes', draft.id);
      assertRevision(current, expectedRevision);
      const now = new Date().toISOString();
      if (current?.trashedAt) throw new Error('Restore this note before editing it.');
      const record: NoteRecord = {
        id: draft.id,
        title: draft.title.trim(),
        document: draft.document,
        notebookId: draft.notebookId,
        tags: normalizeNoteTags(draft.tags),
        pinned: draft.pinned,
        archived: draft.archived,
        reminder: draft.archived ? undefined : draft.reminder,
        links: draft.links,
        createdAt: current?.createdAt ?? now,
        updatedAt: updatedAt(current, now),
        revision: (current?.revision ?? 0) + 1,
      };
      validateNoteRecord(record);
      if (!current && !record.title && !notePreview(record.document)) {
        const hasChecklist = JSON.stringify(record.document).includes('"type":"checklist_item"');
        if (!hasChecklist) return null;
      }
      if (record.notebookId && !await context.get('notebooks', record.notebookId)) {
        throw new Error('This notebook is unavailable.');
      }
      for (const link of record.links) {
        if (current?.links.some(previous => previous.kind === link.kind && previous.id === link.id)) continue;
        if (!await context.get(noteLinkTables[link.kind], link.id)) throw new Error('This linked record is unavailable.');
      }
      if (record.reminder && (record.reminder.id !== current?.reminder?.id || record.reminder.at !== current.reminder.at)) {
        if (record.reminder.id === current?.reminder?.id || record.reminder.at <= now) {
          throw new Error('Choose a future date and time for this reminder.');
        }
      }
      if (current) context.put('notes', record);
      else context.add('notes', record);
      return record;
    }),
    dispose: (epoch, id, revision, action) => transaction.run(async context => {
      await assertEpoch(context, epoch);
      const note = await context.get<NoteRecord>('notes', id);
      assertRevision(note, revision);
      if (!note) throw new Error('This note is unavailable.');
      if (action === 'delete') {
        if (!note.trashedAt) throw new Error('Move this note to Trash before permanent deletion.');
        context.delete('notes', id);
        return;
      }
      if ((action === 'trash') === Boolean(note.trashedAt)) return;
      const time = updatedAt(note);
      context.put<NoteRecord>('notes', {
        ...note, revision: note.revision + 1, updatedAt: time, reminder: undefined,
        trashedAt: action === 'trash' ? time : undefined,
      });
    }),
    saveNotebook: (epoch, key, rawName) => transaction.run(async context => {
      await assertEpoch(context, epoch);
      const id = key?.id ?? globalThis.crypto.randomUUID();
      const current = key ? await context.get<Notebook>('notebooks', id) : undefined;
      assertRevision(current, key?.revision ?? null);
      const time = updatedAt(current);
      const notebook = {
        id, name: normalizeNoteLabel(rawName), revision: (current?.revision ?? 0) + 1,
        createdAt: current?.createdAt ?? time, updatedAt: time,
      };
      validateNotebook(notebook);
      const all = await context.getAll<Notebook>('notebooks');
      if (all.some(row => row.id !== id && row.name.toLowerCase() === notebook.name.toLowerCase())) {
        throw new Error('A notebook with this name already exists.');
      }
      if (current) context.put('notebooks', notebook);
      else context.add('notebooks', notebook);
      return notebook;
    }),
    removeNotebook: (epoch, id, revision) => transaction.run(async context => {
      await assertEpoch(context, epoch);
      assertRevision(await context.get<Notebook>('notebooks', id), revision);
      for (const note of await context.getAll<NoteRecord>('notes')) {
        if (note.notebookId !== id) continue;
        context.put<NoteRecord>('notes', {
          ...note, notebookId: undefined, revision: note.revision + 1, updatedAt: updatedAt(note),
        });
      }
      context.delete('notebooks', id);
    }),
    setView: (epoch, view) => transaction.run(async context => {
      await assertEpoch(context, epoch);
      if (view !== 'list' && view !== 'grid') throw new Error('Invalid Notes layout.');
      context.put('settings', { key: NOTES_VIEW_KEY, value: view });
    }),
  };
}
