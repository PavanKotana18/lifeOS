
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Bold, CheckSquare, Heading2, Italic, List, ListOrdered, Redo2, Underline, Undo2 } from 'lucide-react';
import { baseKeymap, chainCommands, setBlockType, splitBlockAs, toggleMark } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { Fragment, Slice } from 'prosemirror-model';
import { EditorState, Plugin, type Command } from 'prosemirror-state';
import { liftListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { EditorView } from 'prosemirror-view';
import { notesSchema, noteDocument, parseNoteDocument, type NoteDocument } from '../services/notesDocument';
import 'prosemirror-view/style/prosemirror.css';

const { nodes, marks } = notesSchema;
const checklist: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.parent.type === nodes.checklist_item) return setBlockType(nodes.paragraph)(state, dispatch);
  return setBlockType(nodes.checklist_item, { id: crypto.randomUUID(), checked: false })(state, dispatch);
};

const splitChecklist: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.parent.type !== nodes.checklist_item) return false;
  if (!$from.parent.content.size) return setBlockType(nodes.paragraph)(state, dispatch);
  return splitBlockAs(() => ({ type: nodes.checklist_item, attrs: { id: crypto.randomUUID(), checked: false } }))(state, dispatch);
};

const stableChecklistIds = new Plugin({
  appendTransaction(transactions, _old, state) {
    if (!transactions.some(transaction => transaction.docChanged)) return null;
    const seen = new Set<string>();
    const update = state.tr;
    state.doc.descendants((node, pos) => {
      if (node.type !== nodes.checklist_item) return;
      if (seen.has(node.attrs.id)) {
        update.setNodeMarkup(pos, undefined, { id: crypto.randomUUID(), checked: false });
      } else {
        seen.add(node.attrs.id);
      }
    });
    return update.docChanged ? update : null;
  },
  filterTransaction(transaction) {
    return !transaction.docChanged || transaction.doc.content.size <= 128000;
  }
});

function listCommand(node: typeof nodes.bullet_list): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      if ($from.node(depth).type === node) return liftListItem(nodes.list_item)(state, dispatch);
    }
    return wrapInList(node)(state, dispatch);
  };
}

const tools = [
  { label: 'Bold', icon: Bold, command: toggleMark(marks.strong) },
  { label: 'Italic', icon: Italic, command: toggleMark(marks.em) },
  { label: 'Underline', icon: Underline, command: toggleMark(marks.underline) },
  { label: 'Heading', icon: Heading2, command: (state, dispatch) => setBlockType(
    state.selection.$from.parent.type === nodes.heading ? nodes.paragraph : nodes.heading
  )(state, dispatch) },
  { label: 'Bulleted list', icon: List, command: listCommand(nodes.bullet_list) },
  { label: 'Numbered list', icon: ListOrdered, command: listCommand(nodes.ordered_list) },
  { label: 'Checklist', icon: CheckSquare, command: checklist },
  { label: 'Undo', icon: Undo2, command: undo },
  { label: 'Redo', icon: Redo2, command: redo },
] satisfies { label: string; icon: typeof Bold; command: Command }[];

export default function NoteWritingSurface({ initial, autoFocus, readOnly, onChange, onConvert }: {
  initial: NoteDocument;
  autoFocus: boolean;
  readOnly: boolean;
  onChange(value: NoteDocument): void;
  onConvert(text: string): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const inputs = useRef({ initial, autoFocus, readOnly, onChange });
  inputs.current = { initial, autoFocus, readOnly, onChange };
  const [active, setActive] = useState(false);
  const [selection, setSelection] = useState('');
  const [pressed, setPressed] = useState<string[]>([]);

  useEffect(() => {
    if (!host.current) return;
    function updateContext(state: EditorState) {
      const { from, to, $from } = state.selection;
      const text = from !== to ? state.doc.textBetween(from, to, '\n') : '';
      setSelection(text.trim() || ($from.parent.type === nodes.checklist_item ? $from.parent.textContent.trim() : ''));
      const cursorMarks = state.storedMarks ?? $from.marks();
      const labels: string[] = [];
      if (marks.strong.isInSet(cursorMarks)) labels.push('Bold');
      if (marks.em.isInSet(cursorMarks)) labels.push('Italic');
      if (marks.underline.isInSet(cursorMarks)) labels.push('Underline');
      if ($from.parent.type === nodes.heading) labels.push('Heading');
      if ($from.parent.type === nodes.checklist_item) labels.push('Checklist');
      for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type === nodes.bullet_list) labels.push('Bulleted list');
        if ($from.node(depth).type === nodes.ordered_list) labels.push('Numbered list');
      }
      setPressed(current => current.join('|') === labels.join('|') ? current : labels);
    }

    const editor = new EditorView(host.current, {
      state: EditorState.create({
        doc: parseNoteDocument(inputs.current.initial),
        plugins: [
          history(), stableChecklistIds,
          keymap({
            'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo,
            'Mod-b': toggleMark(marks.strong), 'Mod-i': toggleMark(marks.em), 'Mod-u': toggleMark(marks.underline),
            Enter: chainCommands(splitChecklist, splitListItem(nodes.list_item)),
          }),
          keymap(baseKeymap),
        ],
      }),
      attributes: {
        'aria-label': 'Note body', role: 'textbox', 'aria-multiline': 'true',
        'data-placeholder': 'Start writing…', 'aria-placeholder': 'Start writing…',
      },
      editable: () => !inputs.current.readOnly,
      dispatchTransaction(transaction) {
        const previous = editor.state.doc;
        const state = editor.state.apply(transaction);
        editor.updateState(state);
        updateContext(state);
        if (!state.doc.eq(previous)) inputs.current.onChange(noteDocument(state.doc));
      },
      handleDOMEvents: {
        mousedown(_view, event) {
          if (!(event.target instanceof HTMLButtonElement) || !event.target.closest('.note-check-item')) return false;
          event.preventDefault();
          return true;
        },
        click(editorView, event) {
          if (!(event.target instanceof HTMLElement)) return false;
          const button = event.target.closest('button');
          const item = button?.closest('.note-check-item');
          const content = item?.querySelector('span');
          if (!content) return false;
          event.preventDefault();
          if (inputs.current.readOnly) return true;
          const position = editorView.state.doc.resolve(editorView.posAtDOM(content, 0));
          if (position.parent.type !== nodes.checklist_item) return true;
          editorView.dispatch(editorView.state.tr.setNodeMarkup(position.before(), undefined, {
            ...position.parent.attrs, checked: !position.parent.attrs.checked,
          }));
          return true;
        },
        focus: () => { setActive(true); return false; },
        blur: () => { setActive(false); return false; },
        paste(editorView, event) {
          if (inputs.current.readOnly || !event.clipboardData) return false;
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain').slice(0, 120000);
          if (!text) return true;
          const lines = text.replace(/\r\n?/g, '\n').split('\n').slice(0, 4500);
          const paragraphs = lines.map(line => nodes.paragraph.create(null, line ? notesSchema.text(line) : null));
          const slice = new Slice(Fragment.fromArray(paragraphs), 1, 1);
          editorView.dispatch(editorView.state.tr.replaceSelection(slice).scrollIntoView());
          return true;
        },
        drop(_view, event) {
          event.preventDefault();
          return true;
        },
      },

    });
    view.current = editor;
    if (inputs.current.autoFocus && !inputs.current.readOnly) editor.focus();
    return () => { view.current = null; editor.destroy(); };
  }, []);

  useEffect(() => { view.current?.setProps({ editable: () => !readOnly }); }, [readOnly]);

  return <>
    <div className="notes-writing-surface" ref={host} />
    {!readOnly && (active || selection) && (
      <div className="notes-tools" role="toolbar" aria-label="Note formatting"
        onMouseDown={event => event.preventDefault()}>
        {tools.map(({ label, icon: Icon, command }) => (
          <button key={label} type="button" aria-label={label} title={label}
            aria-pressed={label !== 'Undo' && label !== 'Redo' ? pressed.includes(label) : undefined}
            onClick={() => {
              const editor = view.current;
              if (!editor) return;
              command(editor.state, editor.dispatch);
              editor.focus();
            }}>
            <Icon size={19} aria-hidden />
          </button>
        ))}
        {selection && <button type="button" title="Create task from selection"
          aria-label="Create task from selection" onClick={() => onConvert(selection)}>
          <ArrowDownToLine size={19} aria-hidden />
        </button>}
      </div>
    )}
  </>;
}
