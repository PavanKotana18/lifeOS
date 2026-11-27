
import { useDeferredValue, useMemo, useState } from 'react';
import { Archive, BookOpen, Check, FileText, LayoutGrid, List, MoreHorizontal, Pin, Search, SquarePen, Trash2 } from 'lucide-react';
import { FeatherHeader } from './FeatherHeader';
import InfoTip from './InfoTip';
import { notePreview, type NoteNode } from '../services/notesDocument';
import type { NotesView, NotesWorkspaceData } from '../services/encryptedNotes';
import type { NoteRecord, Notebook } from '../services/notesDomain';
import './notes.css';

type Scope = 'workspace' | 'archive' | 'trash';
const headings: Record<Scope, string> = { workspace: 'Notes', archive: 'Archive', trash: 'Trash' };
const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function checklistPreview(node: NoteNode): NoteNode[] {
  return node.type === 'checklist_item' ? [node] : (node.content ?? []).flatMap(checklistPreview);
}

function NoteCard({ note, notebook, onOpen }: { note: NoteRecord; notebook?: string; onOpen(): void }) {
  const excerpt = notePreview(note.document);
  const checks = checklistPreview(note.document.content);
  return <button type="button" className="notes-card" onClick={onOpen}>
    <span className="notes-card-heading">
      <strong>{note.title || excerpt || 'Checklist'}</strong>
      {note.pinned && <Pin size={16} aria-label="Pinned" />}
    </span>
    {note.title && excerpt && <span className="notes-card-preview">{excerpt}</span>}
    {checks.length > 0 && <span className="notes-card-check"><Check size={14} aria-hidden /> {checks.filter(item => item.attrs?.checked).length} of {checks.length} checked</span>}
    <span className="notes-card-meta"><span>{notebook || note.tags[0]}</span><time dateTime={note.updatedAt}>{date.format(new Date(note.updatedAt))}</time></span>
  </button>;
}

export default function NotesWorkspace({ data, loading, onRetry, onClose, onCreate, onOpen, onView, onSaveNotebook, onDeleteNotebook }: {
  data: NotesWorkspaceData;
  loading: boolean;
  onRetry?: () => void;
  onClose(): void;
  onCreate(notebookId?: string): void;
  onOpen(note: NoteRecord): void;
  onView(view: NotesView): void;
  onSaveNotebook(notebook: Notebook | null, name: string): Promise<void>;
  onDeleteNotebook(notebook: Notebook): Promise<void>;
}) {
  const [scope, setScope] = useState<Scope>('workspace');
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());
  const [notebookId, setNotebookId] = useState('');
  const [tag, setTag] = useState('');
  const [menu, setMenu] = useState(false);
  const [managing, setManaging] = useState(false);
  const [editNotebook, setEditNotebook] = useState<Notebook | null>(null);
  const [name, setName] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(60);
  const notebookNames = useMemo(() => new Map(data.notebooks.map(row => [row.id, row.name])), [data.notebooks]);
  const selectedNotebook = notebookNames.has(notebookId) ? notebookId : '';
  const searchable = useMemo(() => data.notes.map(note => ({
    note, search: [note.title, notePreview(note.document), notebookNames.get(note.notebookId || ''), ...note.tags].join(' ').normalize('NFC').toLowerCase(),
  })).sort(({ note: a }, { note: b }) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)),
  [data.notes, notebookNames]);

  const scoped = searchable.filter(({ note }) => scope === 'trash' ? Boolean(note.trashedAt) : !note.trashedAt && note.archived === (scope === 'archive'));
  const tags = Array.from(new Set(scoped.flatMap(({ note }) => note.tags))).sort((a, b) => a.localeCompare(b));
  const selectedTag = tags.includes(tag) ? tag : '';
  const rows = scoped.filter(({ note, search: content }) => (!selectedNotebook || note.notebookId === selectedNotebook) &&
    (!selectedTag || note.tags.includes(selectedTag)) && query.normalize('NFC').split(/\s+/).every(term => content.includes(term))).map(({ note }) => note);
  const pinned = scope === 'workspace' ? rows.filter(note => note.pinned) : [];
  const recent = scope === 'workspace' ? rows.filter(note => !note.pinned) : rows;
  const empty = query || selectedTag ? ['No matching notes', 'Try a different search or clear your filters.'] :
    selectedNotebook ? ['This notebook is empty', 'Write a note here or move one from your workspace.'] :
    scope === 'archive' ? ['Nothing archived', 'Notes you set aside will appear here.'] :
    scope === 'trash' ? ['Trash is empty', 'Deleted notes stay here until you restore or permanently delete them.'] :
    ['A place for your thoughts', 'Start with a thought, a list, or something you want to remember.'];

  function changeScope(next: Scope) {
    setScope(next); setMenu(false); setSearch(''); setNotebookId(''); setTag(''); setLimit(60);
  }

  async function manage(action: () => Promise<void>) {
    setWorking(true); setError('');
    try { await action(); setEditNotebook(null); setName(''); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Unable to update notebooks.'); }
    finally { setWorking(false); }
  }

  function group(title: string, notes: NoteRecord[], count: number) {
    if (!notes.length || count <= 0) return null;
    return <section className="notes-group" aria-label={title}>
      <h3>{title}</h3>
      <div className="notes-grid" data-view={data.view}>
        {notes.slice(0, count).map(note => <NoteCard key={note.id} note={note} notebook={notebookNames.get(note.notebookId || '')} onOpen={() => onOpen(note)} />)}
      </div>
    </section>;
  }

  return <div className="notes-page" data-notes-subscope={scope !== 'workspace' || undefined}>
    <FeatherHeader title={headings[scope]} heading="h1" back={{ label: 'Close', onClick: scope === 'workspace' ? onClose : () => changeScope('workspace') }}
      action={<button className="feather-icon-button" type="button" aria-label="Notes options" aria-expanded={menu}
        onClick={() => setMenu(!menu)}><MoreHorizontal size={22} aria-hidden /></button>} />
    {menu && <div className="notes-menu" aria-label="Notes options">
      {scope !== 'workspace' && <button type="button" onClick={() => changeScope('workspace')}><FileText size={19} aria-hidden /> All notes</button>}
      {scope !== 'archive' && <button type="button" onClick={() => changeScope('archive')}><Archive size={19} aria-hidden /> Archive</button>}
      {scope !== 'trash' && <button type="button" onClick={() => changeScope('trash')}><Trash2 size={19} aria-hidden /> Trash</button>}
      <button type="button" onClick={() => { setMenu(false); setManaging(true); }}><BookOpen size={19} aria-hidden /> Manage notebooks</button>
      <InfoTip label="Archive and trash" triggerText="Archive and trash" />
    </div>}
    <div className="notes-search">
      <Search size={20} aria-hidden />
      <input type="search" placeholder="Search notes" aria-label="Search notes" value={search}
        onChange={event => { setSearch(event.target.value); setLimit(60); }} />
      <button type="button" className="notes-icon" aria-label={data.view === 'list' ? 'Switch to grid view' : 'Switch to list view'}
        onClick={() => onView(data.view === 'list' ? 'grid' : 'list')}>
        {data.view === 'list' ? <LayoutGrid size={20} aria-hidden /> : <List size={21} aria-hidden />}
      </button>
    </div>
    <div className="notes-filters">
      {data.notebooks.length > 0 && <select aria-label="Filter by notebook" value={selectedNotebook} onChange={event => { setNotebookId(event.target.value); setLimit(60); }}>
        <option value="">All notebooks</option>
        {data.notebooks.map(notebook => <option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}
      </select>}
      {tags.length > 0 && <select aria-label="Filter by tag" value={selectedTag} onChange={event => { setTag(event.target.value); setLimit(60); }}>
        <option value="">All tags</option>{tags.map(value => <option key={value}>{value}</option>)}
      </select>}
      {scope === 'workspace' && <button type="button" className="notes-primary" onClick={() => onCreate(selectedNotebook || undefined)}>
        <SquarePen size={19} aria-hidden /> New note
      </button>}
    </div>
    {loading ? <p role="status" className="notes-status">Opening your notes…</p> : onRetry ?
      <div className="notes-empty"><h2>Couldn’t open Notes</h2><button type="button" className="notes-secondary" onClick={onRetry}>Retry</button></div> :
      rows.length ? <>
        {group('Pinned', pinned, limit)}
        {group(scope === 'workspace' ? 'Recent' : headings[scope], recent, limit - pinned.length)}
        {rows.length > limit && <button type="button" className="notes-secondary" onClick={() => setLimit(limit + 60)}>Show more notes</button>}
      </> : <div className="notes-empty"><span className="notes-emblem"><BookOpen size={26} strokeWidth={1.6} aria-hidden /></span>
        <h2>{empty[0]}</h2><p>{empty[1]}</p></div>}
    {managing && <section role="dialog" aria-modal="true" aria-label="Manage notebooks" className="notes-sheet-backdrop" data-notes-sheet>
      <div className="notes-sheet">
        <FeatherHeader title="Notebooks" back={{ label: 'Close', onClick: () => setManaging(false) }} />
        <InfoTip label="Notebooks and tags" triggerText="Organizing notes" />
        <ul className="notes-settings-list">{data.notebooks.map(notebook => <li key={notebook.id}>
          <button type="button" onClick={() => { setEditNotebook(notebook); setName(notebook.name); }}>{notebook.name}</button>
        </li>)}</ul>
        <form className="notes-form" onSubmit={event => { event.preventDefault(); if (!working) void manage(() => onSaveNotebook(editNotebook, name)); }}>
          <label>{editNotebook ? 'Notebook name' : 'New notebook'}<input maxLength={96} value={name} onChange={event => setName(event.target.value)} /></label>
          <div className="notes-actions">
            <button type="submit" className="notes-primary" disabled={!name.trim() || working}>{editNotebook ? 'Save name' : 'Create notebook'}</button>
            {editNotebook && <button type="button" className="notes-secondary" disabled={working} onClick={() => { setEditNotebook(null); setName(''); }}>Cancel</button>}
          </div>
          {editNotebook && <button type="button" className="notes-danger" disabled={working} onClick={() => void manage(() => onDeleteNotebook(editNotebook))}>Remove notebook</button>}
          {error && <p role="alert">{error}</p>}
        </form>
      </div>
    </section>}
  </div>;
}
