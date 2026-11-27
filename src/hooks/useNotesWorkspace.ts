
import { useCallback, useEffect, useRef, useState } from 'react';
import { isEncryptedStorageActivated, sessionManager, StorageService } from '../db';
import type { NoteDisposition, NotesWorkspaceData } from '../services/encryptedNotes';
import { createNoteAutosave, type NoteSaveState } from '../services/noteAutosave';
import { emptyNoteDocument, notePreview } from '../services/notesDocument';
import type { NoteDraft, NoteRecord } from '../services/notesDomain';

export const emptyNotesWorkspace: NotesWorkspaceData = { epoch: '', notes: [], notebooks: [], view: 'list' };

interface EditorSession {
  draft: NoteDraft;
  record: NoteRecord | null;
  status: NoteSaveState;
  autosave: ReturnType<typeof createNoteAutosave>;
}

const blank = (notebookId?: string): NoteDraft => ({
  id: crypto.randomUUID(), title: '', document: emptyNoteDocument, notebookId,
  tags: [], pinned: false, archived: false, links: [],
});

export function useNotesWorkspace() {
  const [data, setData] = useState(emptyNotesWorkspace);
  const [load, setLoad] = useState<'idle' | 'loading' | 'loaded' | 'failed'>('idle');
  const [editor, setEditor] = useState<Omit<EditorSession, 'autosave'> | null>(null);
  const current = useRef<EditorSession | null>(null);
  const snapshot = useRef(emptyNotesWorkspace);
  const serial = useRef(0);
  const loading = useRef<Promise<NotesWorkspaceData> | null>(null);

  const publish = (next: NotesWorkspaceData) => {
    snapshot.current = next;
    setData(next);
  };

  const refresh = useCallback(() => {
    if (!isEncryptedStorageActivated() || !sessionManager.isUnlocked()) {
      return Promise.resolve(emptyNotesWorkspace);
    }
    if (loading.current) return loading.current;
    const request = ++serial.current;
    const session = sessionManager.capture();
    setLoad('loading');
    loading.current = StorageService.notes.workspace().then(next => {
      if (request === serial.current && sessionManager.isCurrent(session)) {
        publish(next);
        setLoad('loaded');
      }
      return next;
    }).catch(error => {
      if (request === serial.current && sessionManager.isCurrent(session)) setLoad('failed');
      throw error;
    }).finally(() => {
      if (request === serial.current) loading.current = null;
    });
    return loading.current;
  }, []);

  function update(next: EditorSession) {
    if (current.current !== next) return;
    setEditor({ draft: next.draft, record: next.record, status: next.status });
  }

  function close() {
    current.current?.autosave.stop();
    current.current = null;
    setEditor(null);
  }

  const invalidate = useCallback(() => {
    serial.current++;
    loading.current = null;
    close();
    publish(emptyNotesWorkspace);
    setLoad('idle');
  }, []);

  const flush = useCallback(() => current.current?.autosave.flush() ?? Promise.resolve(true), []);

  useEffect(() => {
    const visibility = () => { if (document.visibilityState === 'hidden') void flush(); };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [flush]);

  function open(record: NoteRecord | null, ensureAdmission: () => Promise<void>, notebookId?: string) {
    close();
    let epoch = snapshot.current.epoch;
    const active = (): boolean => isEncryptedStorageActivated() && sessionManager.isUnlocked();
    let token = active() ? sessionManager.capture() : null;
    const session: EditorSession = {
      draft: record ? { ...record } : blank(notebookId),
      record,
      status: record ? 'saved' : 'idle',
      autosave: createNoteAutosave({
        revision: record?.revision ?? null,
        async save(draft, revision) {
          if (revision === null && !draft.title.trim() && !notePreview(draft.document) &&
              !JSON.stringify(draft.document).includes('"type":"checklist_item"')) return null;
          if (token === null) {
            await ensureAdmission();
            if (current.current !== session || !active()) throw new Error('Notes session ended.');
            token = sessionManager.capture();
            epoch = (await refresh()).epoch;
          }
          if (current.current !== session || !sessionManager.isCurrent(token)) throw new Error('Notes session ended.');
          return StorageService.notes.save(epoch, revision, draft);
        },
        state(status, saved) {
          if (current.current !== session) return;
          if (saved) {
            session.record = saved;
            const state = snapshot.current;
            const exists = state.notes.some(note => note.id === saved.id);
            publish({ ...state, notes: exists ? state.notes.map(note => note.id === saved.id ? saved : note) : [...state.notes, saved] });
          }
          session.status = status;
          update(session);
        },
      }),
    };
    current.current = session;
    update(session);
  }

  function change(next: NoteDraft) {
    const session = current.current;
    if (!session || next.id !== session.draft.id || session.record?.trashedAt) return;
    session.draft = next;
    session.autosave.change(next);
  }

  async function dispose(action: NoteDisposition) {
    const session = current.current;
    if (!session || !await session.autosave.flush() || current.current !== session) {
      throw new Error('Resolve the unsaved changes first.');
    }
    if (session.record) {
      await StorageService.notes.dispose(snapshot.current.epoch, session.record.id, session.record.revision, action);
      await refresh();
    }
    close();
  }

  return { data, load, editor, open, change, flush, close, dispose, refresh, invalidate };
}
