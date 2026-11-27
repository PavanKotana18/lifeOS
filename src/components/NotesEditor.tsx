
import { lazy, Suspense, useEffect, useState } from 'react';
import { Archive, Bell, BookOpen, Download, Link2, MoreHorizontal, Pin, RotateCcw, Trash2 } from 'lucide-react';
import { FeatherHeader } from './FeatherHeader';
import InfoTip from './InfoTip';
import { normalizeNoteTags, type NoteDraft, type NoteLink, type Notebook } from '../services/notesDomain';
import type { NoteSaveState } from '../services/noteAutosave';
import type { NoteDisposition } from '../services/encryptedNotes';
import './notes.css';

const WritingSurface = lazy(() => import('./NoteWritingSurface'));
type Panel = 'menu' | 'organize' | 'reminder' | 'links' | 'export';
export type NoteLinkOption = NoteLink & { label: string };

function localTime(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function NotesEditor({ draft, status, trashed, notebooks, options, hidden,
  onChange, onClose, onDispose, onRetry, onConvert, onOpenLink, onExport, onDiscard }: {
  draft: NoteDraft;
  status: NoteSaveState;
  trashed: boolean;
  notebooks: Notebook[];
  options: NoteLinkOption[];
  hidden: boolean;
  onChange(next: NoteDraft): void;
  onClose(): void;
  onDispose(action: NoteDisposition): Promise<void>;
  onRetry(): void;
  onConvert(text: string): void;
  onOpenLink(link: NoteLink): void;
  onExport(markdown: boolean): Promise<void>;
  onDiscard(): void;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [tags, setTags] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => setInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
    };
  }, []);
  const announce = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'failed' ? 'Save failed' : '';
  const update = (change: Partial<NoteDraft>) => { if (!trashed) onChange({ ...draft, ...change }); };
  const open = (next: Panel) => { setError(''); setPanel(next); };

  async function perform(action: () => Promise<void>) {
    if (working) return;
    setError(''); setWorking(true);
    try { await action(); setPanel(null); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'The action could not be completed.'); }
    finally { setWorking(false); }
  }

  const alternative = draft.archived ? 'Restore to Notes' : 'Archive note';
  return <section className="notes-editor" aria-label="Note editor" hidden={hidden} style={{ bottom: inset }}
    data-swipe-navigation="off" data-notes-editor>
    <div className="notes-editor-bar">
      <span className="notes-save-state" role="status">{announce}</span>
      <div className="notes-editor-controls">
        {status === 'failed' && <button type="button" className="notes-secondary" onClick={onRetry}>Retry</button>}
        <button type="button" aria-label="Note options" title="Note options" className="feather-icon-button" onClick={() => open('menu')}>
          <MoreHorizontal size={22} aria-hidden />
        </button>
        <button type="button" className="notes-done" onClick={onClose}>Done</button>
      </div>
    </div>
    {status === 'failed' && <div className="notes-save-error" role="alert">
      <span>Your latest changes are still in this editor.</span><button type="button" onClick={onDiscard}>Discard changes</button>
    </div>}
    <div className="notes-editor-page">
      <label className="sr-only" htmlFor="busydoo-note-title">Note title</label>
      <input id="busydoo-note-title" className="notes-title" placeholder="Title" maxLength={240} value={draft.title}
        disabled={trashed} onChange={event => update({ title: event.target.value })} />
      <Suspense fallback={<div className="notes-status" role="status">Opening editor…</div>}>
        <WritingSurface initial={draft.document} autoFocus={!trashed} readOnly={trashed}
          onChange={value => update({ document: value })} onConvert={onConvert} />
      </Suspense>
    </div>

    {panel && <section className="notes-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Note options" data-notes-sheet>
      <div className="notes-sheet">
        <FeatherHeader title={{ menu: 'Note options', organize: 'Organize', reminder: 'Reminder', links: 'Linked records', export: 'Export note' }[panel]}
          back={{ label: 'Close', onClick: () => setPanel(null) }} />
        {error && <p role="alert" className="notes-save-error">{error}</p>}
        {panel === 'menu' && <div className="notes-menu">
          {!trashed ? <>
            <button type="button" onClick={() => { update({ pinned: !draft.pinned }); setPanel(null); }}><Pin size={19} aria-hidden />{draft.pinned ? 'Unpin note' : 'Pin note'}</button>
            <button type="button" onClick={() => { setTags(draft.tags.join(', ')); open('organize'); }}><BookOpen size={19} aria-hidden />Organize</button>
            {!draft.archived && <button type="button" onClick={() => { setRemindAt(localTime(draft.reminder?.at)); open('reminder'); }}><Bell size={19} aria-hidden />{draft.reminder ? 'Edit reminder' : 'Set reminder'}</button>}
            <button type="button" onClick={() => open('links')}><Link2 size={19} aria-hidden />Linked records</button>
            <button type="button" onClick={() => open('export')}><Download size={19} aria-hidden />Export note</button>
            <button type="button" onClick={() => { update({ archived: !draft.archived, reminder: undefined }); setPanel(null); }}><Archive size={19} aria-hidden />{alternative}</button>
            <button type="button" className="notes-danger" disabled={working} onClick={() => void perform(() => onDispose('trash'))}><Trash2 size={19} aria-hidden />Move to Trash</button>
          </> : <>
            <button type="button" disabled={working} onClick={() => void perform(() => onDispose('restore'))}><RotateCcw size={19} aria-hidden />Restore note</button>
            <button type="button" className="notes-danger" disabled={working} onClick={() => void perform(() => onDispose('delete'))}><Trash2 size={19} aria-hidden />Delete permanently</button>
            <InfoTip label="Permanent note deletion" triggerText="About permanent deletion" />
          </>}
          <InfoTip label="Private notes" triggerText="Storage and autosave" />
        </div>}
        {panel === 'organize' && <form className="notes-form" onSubmit={event => {
          event.preventDefault();
          const normalized = normalizeNoteTags(tags.split(','));
          if (normalized.length > 20 || normalized.some(value => value.length > 48)) {
            setError('Use up to 20 tags, each 48 characters or fewer.'); return;
          }
          update({ tags: normalized }); setPanel(null);
        }}>
          <InfoTip label="Notebooks and tags" triggerText="Organizing notes" />
          <label>Notebook<select value={draft.notebookId || ''} onChange={event => update({ notebookId: event.target.value || undefined })}>
            <option value="">No notebook</option>
            {notebooks.map(notebook => <option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}
          </select></label>
          <label>Tags<input value={tags} maxLength={1000} placeholder="Separate tags with commas" onChange={event => setTags(event.target.value)} /></label>
          <button className="notes-primary" type="submit">Done</button>
        </form>}
        {panel === 'reminder' && <form className="notes-form" onSubmit={event => {
          event.preventDefault();
          const date = new Date(remindAt);
          if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now() || localTime(date.toISOString()) !== remindAt) {
            setError('Choose an available future date and time.'); return;
          }
          const at = date.toISOString();
          if (at !== draft.reminder?.at) update({ reminder: { id: crypto.randomUUID(), at } });
          setPanel(null);
        }}>
          <InfoTip label="Note reminders" triggerText="How reminders work" />
          <label>Date and time<input type="datetime-local" required value={remindAt} min={localTime(new Date().toISOString())}
            onChange={event => setRemindAt(event.target.value)} /></label>
          <button type="submit" className="notes-primary">Save reminder</button>
          {draft.reminder && <button type="button" className="notes-danger" onClick={() => { update({ reminder: undefined }); setPanel(null); }}>Remove reminder</button>}
        </form>}
        {panel === 'links' && <div className="notes-form">
          <InfoTip label="Linked note records" triggerText="About links" />
          {draft.links.map(ref => {
            const current = options.find(option => option.id === ref.id && option.kind === ref.kind);
            return <div className="notes-link-row" key={ref.kind + ':' + ref.id}>
              <button type="button" className="notes-secondary" disabled={!current} onClick={() => onOpenLink(ref)}>
                {current?.label || 'Record unavailable'}
              </button>
              <button type="button" className="notes-secondary" aria-label={'Remove link to ' + (current?.label || 'unavailable record')}
                onClick={() => update({ links: draft.links.filter(item => item !== ref) })}>Remove</button>
            </div>;
          })}
          <form className="notes-form" onSubmit={event => {
            event.preventDefault();
            const option = options.find(item => item.kind + ':' + item.id === link);
            if (option) { update({ links: [...draft.links, { kind: option.kind, id: option.id }] }); setLink(''); }
          }}>
            <label>Link a record<select value={link} onChange={event => setLink(event.target.value)}>
              <option value="">Choose a record</option>
              {options.filter(option => !draft.links.some(ref => option.id === ref.id && option.kind === ref.kind)).map(option =>
                <option key={option.kind + ':' + option.id} value={option.kind + ':' + option.id}>{option.label}</option>)}
            </select></label>
            <button type="submit" className="notes-primary" disabled={!link || draft.links.length >= 50}>Add link</button>
          </form>
        </div>}
        {panel === 'export' && <div className="notes-form">
          <p>Exported files are readable and unencrypted. Anyone with access to the file can read this note.</p>
          <InfoTip label="Readable note exports" triggerText="Export formats" />
          <button type="button" className="notes-primary" disabled={working} onClick={() => void perform(() => onExport(false))}>Save plain text</button>
          <button type="button" className="notes-secondary" disabled={working} onClick={() => void perform(() => onExport(true))}>Save Markdown</button>
        </div>}
      </div>
    </section>}
  </section>;
}
