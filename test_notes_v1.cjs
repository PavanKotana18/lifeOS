
'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { fixture } = require('./tests/wp0/production-harness.cjs');

async function main() {
  const f = await fixture();
  const storage = f.StorageService;
  const { parseNoteDocument, notePreview, exportNoteText, emptyNoteDocument } = f.load('src/services/notesDocument.ts');
  const { createNoteAutosave } = f.load('src/services/noteAutosave.ts');
  const { buildInboxSnapshot } = f.load('src/services/notificationInboxProducers.ts');
  const { changeNotificationInbox, nativeInboxEvent } = f.load('src/services/notificationInbox.ts');
  const { validateBackupTables } = f.load('src/db.ts');
  const at = new Date(Date.now() + 60_000).toISOString();
  const content = { version: 1, content: { type: 'doc', content: [
    { type: 'heading', content: [{ type: 'text', text: 'Field notes — भारत' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Private café ☕', marks: [{ type: 'strong' }] }] },
    { type: 'checklist_item', attrs: { id: 'check-one', checked: true }, content: [{ type: 'text', text: 'Water plants' }] },
    { type: 'ordered_list', attrs: { order: 2 }, content: [{ type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Leave early' }] }] }] }
  ] } };
  const draft = id => ({ id, title: '', document: content, tags: [], pinned: false, archived: false, links: [] });
  const now = Date.now();
  let disposed = false;
  try {
    const empty = await storage.notes.workspace();
    assert.equal(empty.notes.length, 0);
    assert.equal(await storage.notes.save(empty.epoch, null, { ...draft('empty'), document: emptyNoteDocument }), null);
    const notebook = await storage.notes.saveNotebook(empty.epoch, null, '  Garden  journal  ');
    const renamed = await storage.notes.saveNotebook(empty.epoch, notebook, 'Home journal');
    assert.equal(renamed.name, 'Home journal');
    assert.equal(renamed.revision, 2);
    await assert.rejects(storage.notes.saveNotebook(empty.epoch, null, 'home journal'));
    await assert.rejects(storage.notes.save(empty.epoch, null, { ...draft('missing'), notebookId: 'missing' }));
    await assert.rejects(storage.notes.save(empty.epoch, null, { ...draft('broken-link'), links: [{ kind: 'task', id: 'missing' }] }));
    const task = await storage.tasks.add({ title: 'A synthetic task', priority: 'Medium', completed: false, recurring: 'None' });
    const first = await storage.notes.save(empty.epoch, null, { ...draft('note-a'), notebookId: notebook.id,
      tags: [' Café ', 'CAFE\u0301', 'weekend'], pinned: true, reminder: { id: 'current-alarm', at },
      links: [{ kind: 'task', id: task.id }] });
    assert.deepEqual(first.tags, ['Café', 'weekend']);
    assert.equal(first.title, '');
    assert.equal(notePreview(first.document), 'Field notes — भारत Private café ☕ Water plants Leave early');
    assert.match(exportNoteText(first.document, '', true), /## Field notes.*\n\n\*\*Private café ☕\*\*\n\n- \[x\] Water plants\n2\. Leave early/u);
    const raw = await f.lifeOSDatabase.notes.get(first.id);
    assert.equal(raw.__lifeosEncrypted, 1);
    assert.deepEqual(Object.keys(raw).sort(), ['__lifeosEncrypted', 'encrypted', 'id']);
    assert.doesNotMatch(JSON.stringify(raw), /Private café|weekend|current-alarm|check-one/u);
    assert.equal((await f.lifeOSDatabase.notebooks.get(notebook.id)).__lifeosEncrypted, 1);
    await assert.rejects(storage.notes.save(empty.epoch, 0, first));
    await storage.tasks.delete(task.id);
    const saved = await storage.notes.save(empty.epoch, first.revision, { ...first, title: 'Edited privately' });
    assert.deepEqual(saved.reminder, first.reminder, 'content editing keeps the reminder identity');
    assert.deepEqual(saved.links, first.links, 'a deleted link remains safely detachable');
    const native = nativeInboxEvent({ kind: 'notesReminder', noteId: first.id, reminderId: 'current-alarm', occurrenceAt: at }, 'delivered', Date.parse(at));
    assert.equal(native.occurrence, 'current-alarm');
    assert.equal(nativeInboxEvent({ kind: 'notesReminder', noteId: first.id }, 'opened'), undefined);
    const snapshot = notes => buildInboxSnapshot({
      notes, now: new Date(Date.parse(at) + 500), preferences: { enabled: true },
      reminderPreferences: { notesReminders: true }, dateOnlyAlertTime: '',
      tasks: [], habits: [], habitLogs: [], goals: [], milestones: [], commitments: [],
      savings: [], budgets: [], transactions: [], categories: [], recoveryPending: false,
    });
    const same = snapshot([saved]);
    assert.equal(same.acceptsObservation(native), true);
    assert.equal(same.events.length, 1);
    const rows = changeNotificationInbox([], { sources: same.sources, events: [same.events[0], native] }, Date.parse(at) + 500);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].evidence, 'delivered');
    const stale = snapshot([{ ...saved, reminder: { id: 'new-alarm', at } }]);
    assert.equal(stale.acceptsObservation(native), false);
    assert.ok(changeNotificationInbox(rows, { sources: stale.sources }, Date.parse(at) + 500)[0].resolvedAt);
    assert.equal(changeNotificationInbox(rows, { sources: {}, notesPending: true }, Date.parse(at) + 500)[0].resolvedAt, undefined);
    await storage.notes.removeNotebook(empty.epoch, renamed.id, renamed.revision);
    const detached = (await storage.notes.workspace()).notes[0];
    assert.equal(detached.notebookId, undefined);
    const archived = await storage.notes.save(empty.epoch, detached.revision, { ...detached, archived: true });
    assert.equal(archived.reminder, undefined);
    const active = await storage.notes.save(empty.epoch, archived.revision, { ...archived, archived: false });
    assert.equal(active.reminder, undefined);
    await storage.notes.dispose(empty.epoch, active.id, active.revision, 'trash');
    const trashed = (await storage.notes.workspace()).notes[0];
    await assert.rejects(storage.notes.save(empty.epoch, trashed.revision, trashed), /Restore/);
    await storage.notes.dispose(empty.epoch, trashed.id, trashed.revision, 'restore');
    const restored = (await storage.notes.workspace()).notes[0];
    assert.equal(restored.trashedAt, undefined);
    await assert.rejects(storage.notes.dispose(empty.epoch, restored.id, restored.revision, 'delete'), /Trash/);
    await storage.notes.setView(empty.epoch, 'grid');
    const backup = await storage.backup.exportData();
    const malformed = JSON.parse(backup);
    malformed.tables.notes[0].document.content.content.push({ type: 'image', attrs: { src: 'https://invalid.test' } });
    await assert.rejects(storage.backup.importData(JSON.stringify(malformed), { replaceExisting: true }));
    assert.equal((await storage.notes.workspace()).notes[0].id, first.id);
    const older = JSON.parse(backup);
    delete older.tables.notes; delete older.tables.notebooks;
    assert.equal(validateBackupTables(older.tables).length, 17);
    assert.deepEqual(older.tables.notes, []);
    await storage.backup.clearAll();
    await assert.rejects(storage.notes.save(empty.epoch, null, draft('pending')), /workspace changed/);
    await storage.backup.importData(backup, { replaceExisting: true });
    const roundtrip = await storage.notes.workspace();
    assert.deepEqual(roundtrip.notes[0].document, first.document);
    assert.equal(roundtrip.view, 'grid');
    assert.notEqual(roundtrip.epoch, empty.epoch);
    f.sessionManager.lock();
    await assert.rejects(storage.notes.workspace());
    await assert.rejects(storage.notes.save(roundtrip.epoch, null, draft('locked')));
    const restarted = await f.restart();
    try {
      await assert.rejects(restarted.StorageService.notes.workspace());
      restarted.sessionManager.unlock();
      await restarted.load('src/services/cryptoService.ts').CryptoService.unlock();
      await restarted.activateEncryptedStorage();
      const recovered = await restarted.StorageService.notes.workspace();
      assert.equal(recovered.notes[0].revision, restored.revision);
      assert.equal(recovered.notes[0].title, 'Edited privately');
      await restarted.StorageService.notes.dispose(recovered.epoch, recovered.notes[0].id, recovered.notes[0].revision, 'trash');
      const last = (await restarted.StorageService.notes.workspace()).notes[0];
      await restarted.StorageService.notes.dispose(recovered.epoch, last.id, last.revision, 'delete');
      assert.equal((await restarted.StorageService.notes.workspace()).notes.length, 0);
    } finally { restarted.sessionManager.lock(); restarted.lifeOSDatabase.close(); }

    let release, call = 0;
    const states = [];
    const autosave = createNoteAutosave({ revision: null, delay: 10000,
      state: status => states.push(status),
      async save(snapshot, revision) {
        call++;
        if (call === 1) {
          assert.equal(revision, null);
          await new Promise(resolve => { release = resolve; });
        }
        if (call === 2) throw Error('Synthetic write failure');
        if (call > 1) assert.equal(revision, 1);
        return { ...snapshot, revision: call === 1 ? 1 : 2 };
      }
    });
    autosave.change({ ...draft('autosave'), title: 'a' });
    const pending = autosave.flush();
    autosave.change({ ...draft('autosave'), title: 'ab' });
    autosave.change({ ...draft('autosave'), title: 'abc' });
    assert.equal(await Promise.resolve(states.includes('saved')), false);
    release();
    assert.equal(await pending, false);
    assert.equal(states.at(-1), 'failed');
    assert.equal(await autosave.flush(), true);
    assert.equal(states.at(-1), 'saved');
    assert.equal(call, 3);
    autosave.stop();

    await f.dispose();
    disposed = true;
    const perf = await fixture();
    try {
      const { epoch } = await perf.StorageService.notes.workspace();
      const lines = Array.from({ length: 200 }, (_, index) => ({
        type: 'paragraph', content: [{ type: 'text', text: ('Line ' + index + ' कैलेंडर ').repeat(16) }],
      }));
      const large = { version: 1, content: { type: 'doc', content: lines } };
      parseNoteDocument(large);
      const start = performance.now();
      await perf.StorageService.notes.save(epoch, null, { ...draft('large-note'), document: large });
      const largeMs = performance.now() - start;
      for (let i = 0; i < 999; i++) await perf.StorageService.notes.save(epoch, null, { ...draft('synthetic-' + i), title: 'Synthetic ' + i });
      const loadStart = performance.now();
      const workspace = await perf.StorageService.notes.workspace();
      const loadMs = performance.now() - loadStart;
      assert.equal(workspace.notes.length, 1000);
      const searchStart = performance.now();
      const hits = workspace.notes.filter(note => [note.title, notePreview(note.document), ...note.tags].join(' ').toLowerCase().includes('synthetic 998'));
      const searchMs = performance.now() - searchStart;
      assert.equal(hits.length, 1);
      console.log(JSON.stringify({ fixture: 'Node AES-GCM / fake-indexeddb', records: 1000, documentBytes: Buffer.byteLength(JSON.stringify(large)),
        largeSaveMs: largeMs.toFixed(1), workspaceReadMs: loadMs.toFixed(1), decryptedSearchMs: searchMs.toFixed(1) }));
    } finally { await perf.dispose(); }
    console.log('Notes V1 encrypted domain, lifecycles, backup, reminder identities and autosave passed in ' + (Date.now() - now) + ' ms.');
  } finally { if (!disposed) await f.dispose(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
