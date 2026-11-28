
import type { NoteDraft, NoteRecord } from './notesDomain';

export type NoteSaveState = 'idle' | 'saving' | 'saved' | 'failed';
interface AutosaveOptions {
  revision: number | null;
  save(draft: NoteDraft, expectedRevision: number | null): Promise<NoteRecord | null>;
  state(state: NoteSaveState, record?: NoteRecord | null): void;
  delay?: number;
}

export function createNoteAutosave(options: AutosaveOptions) {
  let revision = options.revision;
  let pending: NoteDraft | null = null;
  let running: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ended = false;

  function flush(): Promise<boolean> {
    clearTimeout(timer);
    if (ended) return Promise.resolve(false);
    if (running) return running;
    if (!pending) return Promise.resolve(true);
    running = (async () => {
      while (pending && !ended) {
        const snapshot = pending;
        try {
          const record = await options.save(snapshot, revision);
          if (ended) return false;
          if (record) revision = record.revision;
          if (pending === snapshot) pending = null;
          options.state(pending ? 'saving' : record ? 'saved' : 'idle', record);
        } catch {
          if (!ended) options.state('failed');
          return false;
        }
      }
      return !ended;
    })().finally(() => { running = null; });
    return running;
  }

  return {
    change(draft: NoteDraft) {
      if (ended) return;
      pending = draft;
      options.state('saving');
      clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, options.delay ?? 275);
    },
    flush,
    stop() {
      ended = true;
      pending = null;
      clearTimeout(timer);
    },
  };
}
