
# BusyDoo Notes V1

## Data inventory and legal draft evidence

| Data | Location and permitted access | Deletion and portability |
| --- | --- | --- |
| Notes, checklists, tags and linked IDs | Authenticated encrypted records in the identity-keyed Notes store. Search runs in memory after unlock. Linked record contents remain in their original stores. | Trash is recoverable and has no automatic purge. Permanent deletion removes the note. Reset clears Notes. Encrypted backups and files already exported remain independently controllable. |
| Notebook names | Authenticated encrypted records in the identity-keyed Notebooks store. | Removing a notebook detaches its notes atomically. Reset clears notebooks. |
| Unsaved editor contents | In-memory draft only. The app flushes when leaving safely, then drops private memory views on lock or background without postponing native locking. | Termination or lock can lose the latest edit if the encrypted write has not completed. Retry is available while the editor is open. |
| Reminder and history | Reminder configurations are encrypted with the note. Android receives generic copy, opaque note/reminder IDs and the fixed UTC occurrence. The Notification Centre stores encrypted event history. | Archive and Trash clear the schedule. Reset cancels record reminders. Existing inbox retention and dismiss rules apply. Pending alarms, delivered notifications and device diagnostics have distinct lifecycles. |
| Readable exports | Plain text or Markdown passed to Android’s system document picker. The user is warned that readable exports are unencrypted. Browser fixtures use local Blob downloads. | Reset cannot clear a file written to a separate provider. The provider controls its own storage and synchronization. |

Notes does not add network access, tracking, a public privacy statement, legal enforcement or acceptance collection. The current legal draft remains inactive. Any future publication must still resolve its existing support, policy dates and release-evidence gates.

## Engineering

ProseMirror provides documented schema-driven editing, transactions, history and selection. The editor uses locally bundled packages and intentionally pastes clipboard text without parsing clipboard HTML. Android composition still needs physical WebView evidence. Packaged open-source notices contain the MIT text from the newly resolved dependency tree.

Dexie v3 adds identity-only Notes and Notebooks stores. The existing encryption codec and Android key protect both. Updates take an expected revision. The encrypted workspace epoch changes on reset or restore, so a queued creation from a prior dataset cannot repopulate it. Older backups omit the optional Notes tables. Restore validates structured notes and notebook references before committing. Dangling linked record references remain detachable and are presented as unavailable.

One-time reminders are interpreted as local wall time at creation and committed as a fixed UTC instant. Travelling changes the displayed local time, not the scheduled instant. The Android schedule carries a reminder ID independent of the note revision. An opened or delivered observation must match that ID and instant to be admitted. An in-app due row alone does not establish Android delivery.
