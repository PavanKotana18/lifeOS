import { Fragment, type Node as PMNode, type NodeType } from 'prosemirror-model';
import { TextSelection, type Command } from 'prosemirror-state';
import { setBlockType, splitBlockAs } from 'prosemirror-commands';
import { liftListItem } from 'prosemirror-schema-list';
import { closeHistory } from 'prosemirror-history';
import { notesSchema, noteDocument, parseNoteDocument } from './notesDocument';

const { nodes } = notesSchema;
const checkAttrs = () => ({ id: crypto.randomUUID(), checked: false });
const isList = (node: PMNode) => node.type === nodes.bullet_list || node.type === nodes.ordered_list;

/** Enter creates a distinct unchecked row. An empty row exits checklist mode. */
export const splitChecklist: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.parent.type !== nodes.checklist_item) return false;
  if (!$from.parent.content.size) return setBlockType(nodes.paragraph)(state, dispatch);
  if (!(state.selection instanceof TextSelection) || !$from.sameParent(state.selection.$to)) {
    return splitBlockAs(() => ({ type: nodes.checklist_item, attrs: checkAttrs() }))(state, dispatch);
  }
  const tr = state.tr.deleteSelection();
  const pos = tr.selection.from;
  tr.split(pos, 1, [{ type: nodes.checklist_item, attrs: checkAttrs() }]);
  tr.setSelection(TextSelection.create(tr.doc, pos + 2));
  if (state.selection.empty) tr.setStoredMarks(state.storedMarks ?? $from.marks());
  if (dispatch) dispatch(tr.scrollIntoView());
  return true;
};

/** Convert the containing list or selected blocks in a single undoable transaction. */
export function formatNoteList(requested: NodeType): Command {
  return (state, dispatch) => {
    const { selection, doc } = state;
    const send: typeof dispatch = dispatch ? tr => dispatch(closeHistory(tr)) : undefined;
    if (!(selection instanceof TextSelection)) return false;
    const { $from, $to } = selection;
    if (!$from.depth || !$to.depth) return false;
    const blocks: { node: PMNode; pos: number }[] = [];
    doc.forEach((node, pos) => blocks.push({ node, pos }));
    let first = $from.index(0), last = $to.index(0);
    if (!selection.empty && $to.depth === 1 && $to.parentOffset === 0 && last > first) last--;
    if (!blocks[first] || !blocks[last]) return false;
    let target = requested;
    const current = blocks[first].node;
    if (selection.empty && current.type === nodes.checklist_item) {
      if (target === nodes.checklist_item) return setBlockType(nodes.paragraph)(state, send);
      while (first > 0 && blocks[first - 1].node.type === nodes.checklist_item) first--;
      while (last + 1 < blocks.length && blocks[last + 1].node.type === nodes.checklist_item) last++;
    }
    if (first === last && isList(current) && target !== nodes.checklist_item) {
      if (current.type === target) return liftListItem(nodes.list_item)(state, send);
      if (send) send(state.tr.setNodeMarkup(blocks[first].pos, target,
        target === nodes.ordered_list ? { order: 1 } : null).scrollIntoView());
      return true;
    }
    if (target === nodes.checklist_item && blocks.slice(first, last + 1).every(({ node }) => node.type === target)) {
      target = nodes.paragraph;
    }
    const start = blocks[first].pos, end = blocks[last].pos + blocks[last].node.nodeSize;
    const originals: { node: PMNode; pos: number }[] = [];
    doc.nodesBetween(start, end, (node, pos) => {
      if (node.isTextblock) { originals.push({ node, pos }); return false; }
      return true;
    });
    if (!originals.length) return false;
    // Preserve all inline text, marks and hard breaks. Checklist rows are flat by schema.
    const converted = originals.map(({ node }) => {
      if (target === nodes.checklist_item) return target.create(node.type === target ? node.attrs : checkAttrs(), node.content);
      return nodes.paragraph.create(null, node.content);
    });
    const replacement = target === nodes.bullet_list || target === nodes.ordered_list
      ? [target.create(target === nodes.ordered_list ? { order: 1 } : null,
          converted.map(node => nodes.list_item.create(null, node)))]
      : converted;
    const fragment = Fragment.fromArray(replacement);
    const tr = state.tr.replaceWith(start, end, fragment);
    try { parseNoteDocument(noteDocument(tr.doc)); } catch { return false; }
    const positions: { pos: number; size: number }[] = [];
    tr.doc.nodesBetween(start, start + fragment.size, (node, pos) => {
      if (node.isTextblock) { positions.push({ pos: pos + 1, size: node.content.size }); return false; }
      return true;
    });
    if (positions.length !== originals.length) return false;
    const relocate = (pos: number) => {
      let i = originals.findIndex(({ node, pos: p }) => pos >= p + 1 && pos <= p + 1 + node.content.size);
      if (i < 0) i = pos <= start ? 0 : originals.length - 1;
      const offset = Math.max(0, Math.min(positions[i].size, pos - originals[i].pos - 1));
      return positions[i].pos + offset;
    };
    tr.setSelection(TextSelection.create(tr.doc, relocate(selection.anchor), relocate(selection.head)));
    if (selection.empty && state.storedMarks) tr.setStoredMarks(state.storedMarks);
    if (send) send(tr.scrollIntoView());
    return true;
  };
}
