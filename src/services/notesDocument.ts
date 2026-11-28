
import { Schema, type Node as DocumentNode } from 'prosemirror-model';
import { addListNodes } from 'prosemirror-schema-list';

export interface NoteNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: NoteNode[];
}

export interface NoteDocument {
  version: 1;
  content: NoteNode;
}

export const emptyNoteDocument: NoteDocument = {
  version: 1,
  content: { type: 'doc', content: [{ type: 'paragraph' }] }
};

const base = new Schema({
  nodes: {
    doc: { content: 'block+' },
    text: { group: 'inline' },
    paragraph: {
      group: 'block', content: 'inline*',
      parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0]
    },
    heading: {
      group: 'block', content: 'inline*', defining: true,
      parseDOM: [{ tag: 'h2' }], toDOM: () => ['h2', 0]
    },
    hard_break: {
      group: 'inline', inline: true, selectable: false,
      parseDOM: [{ tag: 'br' }], toDOM: () => ['br']
    },
    checklist_item: {
      group: 'block', content: 'inline*', defining: true,
      attrs: { id: {}, checked: { default: false } },
      // Preserve checklist identity when Android/WebView reparses edited DOM.
      parseDOM: [{ tag: 'div.note-check-item[data-check-id]', contentElement: 'span', getAttrs: dom => {
        const element = dom as HTMLElement;
        const id = element.getAttribute('data-check-id');
        if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return false;
        return { id, checked: element.querySelector('button')?.getAttribute('aria-pressed') === 'true' };
      } }],
      toDOM: node => [
        'div', { class: 'note-check-item', 'data-check-id': node.attrs.id },
        ['button', {
          type: 'button', contenteditable: 'false', 'aria-label': 'Completed',
          'aria-pressed': String(node.attrs.checked)
        }, node.attrs.checked ? '✓' : ''],
        ['span', 0]
      ]
    }
  },
  marks: {
    strong: { parseDOM: [{ tag: 'strong' }, { tag: 'b' }], toDOM: () => ['strong', 0] },
    em: { parseDOM: [{ tag: 'em' }, { tag: 'i' }], toDOM: () => ['em', 0] },
    underline: { parseDOM: [{ tag: 'u' }], toDOM: () => ['u', 0] }
  }
});

export const notesSchema = new Schema({
  nodes: addListNodes(base.spec.nodes, 'paragraph block*', 'block'),
  marks: base.spec.marks
});

const nodeTypes = new Set(Object.keys(notesSchema.nodes));
const markTypes = new Set(Object.keys(notesSchema.marks));
const documentFields = new Set(['type', 'attrs', 'marks', 'text', 'content']);
export const noteIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;

function invalidDocument(): never {
  throw new Error('The note contains invalid or oversized content.');
}

export function isNoteObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseNoteDocument(value: unknown): DocumentNode {
  if (!isNoteObject(value) || value.version !== 1 || Object.keys(value).length !== 2) {
    return invalidDocument();
  }
  let count = 0;
  let length = 0;
  const checklistIds = new Set<string>();

  function inspect(node: unknown, depth: number): void {
    if (!isNoteObject(node) || depth > 12 || ++count > 5000 ||
        Object.keys(node).some(key => !documentFields.has(key)) ||
        typeof node.type !== 'string' || !nodeTypes.has(node.type)) {
      invalidDocument();
    }
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || !node.text || (length += node.text.length) > 120000) {
        invalidDocument();
      }
      if (node.content !== undefined) invalidDocument();
    } else if (node.text !== undefined || node.marks !== undefined) {
      invalidDocument();
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks) || node.marks.length > markTypes.size) invalidDocument();
      const seen = new Set();
      for (const mark of node.marks) {
        if (!isNoteObject(mark) || Object.keys(mark).length !== 1 ||
            typeof mark.type !== 'string' || !markTypes.has(mark.type) || seen.has(mark.type)) {
          invalidDocument();
        }
        seen.add(mark.type);
      }
    }
    if (node.type === 'checklist_item') {
      const attrs = node.attrs;
      if (!isNoteObject(attrs) || Object.keys(attrs).length !== 2 ||
          typeof attrs.id !== 'string' || !noteIdPattern.test(attrs.id) ||
          typeof attrs.checked !== 'boolean' || checklistIds.has(attrs.id)) {
        invalidDocument();
      }
      checklistIds.add(attrs.id);
    } else if (node.type === 'ordered_list') {
      const attrs = node.attrs;
      if (attrs !== undefined && (!isNoteObject(attrs) || Object.keys(attrs).length !== 1 ||
          typeof attrs.order !== 'number' || !Number.isInteger(attrs.order) ||
          attrs.order < 1 || attrs.order > 10000)) invalidDocument();
    } else if (node.attrs !== undefined) {
      invalidDocument();
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content) || node.content.length > 5000) invalidDocument();
      node.content.forEach(child => inspect(child, depth + 1));
    }
  }

  inspect(value.content, 0);
  try {
    const doc = notesSchema.nodeFromJSON(value.content);
    if (doc.type !== notesSchema.topNodeType) return invalidDocument();
    doc.check();
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 512000) return invalidDocument();
    return doc;
  } catch {
    return invalidDocument();
  }
}

export function noteDocument(node: DocumentNode): NoteDocument {
  return { version: 1, content: node.toJSON() };
}

export function notePreview(document: NoteDocument): string {
  const lines: string[] = [];
  function walk(node: NoteNode) {
    if (node.text) lines.push(node.text);
    if (node.type === 'hard_break') lines.push(' ');
    node.content?.forEach(walk);
    if (['paragraph', 'heading', 'checklist_item'].includes(node.type)) lines.push(' ');
  }
  walk(document.content);
  return lines.join('').trim();
}

function escapeMarkdown(value: string) {
  return value.replace(/[\\&<>*_[\]{}()#!|~+.\x60-]/g, '\\$&');
}

export function exportNoteText(document: NoteDocument, title: string, markdown: boolean): string {
  function render(node: NoteNode, indent = ''): string {
    if (node.type === 'text') {
      let value = markdown ? escapeMarkdown(node.text ?? '') : node.text ?? '';
      if (markdown) {
        for (const { type } of node.marks ?? []) {
          if (type === 'strong') value = '**' + value + '**';
          if (type === 'em') value = '*' + value + '*';
          if (type === 'underline') value = '<u>' + value + '</u>';
        }
      }
      return value;
    }
    if (node.type === 'ordered_list' || node.type === 'bullet_list') {
      return (node.content ?? []).map((item, i) => {
        const prefix = node.type === 'bullet_list' ? '- ' : String(Number(node.attrs?.order ?? 1) + i) + '. ';
        const children = item.content ?? [];
        return indent + prefix + (children[0] ? render(children[0]).trimEnd() : '') + '\n' +
          children.slice(1).map(child => render(child, indent + ' '.repeat(prefix.length))).join('');
      }).join('') + (indent ? '' : '\n');
    }
    const body = (node.content ?? []).map(child => render(child)).join('');
    switch (node.type) {
      case 'heading': return indent + (markdown ? '## ' : '') + body + '\n\n';
      case 'paragraph': return indent + body + '\n\n';
      case 'checklist_item': return indent + (node.attrs?.checked ? '- [x] ' : '- [ ] ') + body + '\n';
      case 'hard_break': return markdown ? '  \n' : '\n';
      default: return body;
    }
  }
  const body = render(document.content).trimEnd();
  const heading = title ? (markdown ? '# ' + escapeMarkdown(title) : title) : '';
  return [heading, body].filter(Boolean).join('\n\n') + '\n';
}
