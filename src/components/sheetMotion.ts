const closing = new WeakSet<HTMLDialogElement>();

export function showSheet(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.open) return;
  delete dialog.dataset.sheetClosing;
  dialog.showModal();
}

export function closeSheet(dialog: HTMLDialogElement | null) {
  if (!dialog?.open || closing.has(dialog)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { dialog.close(); return; }
  closing.add(dialog);
  dialog.dataset.sheetClosing = 'true';
  setTimeout(() => {
    closing.delete(dialog);
    if (dialog.open) dialog.close();
    delete dialog.dataset.sheetClosing;
  }, 230);
}

export function cancelSheet(event: { preventDefault(): void; currentTarget: HTMLDialogElement }) {
  event.preventDefault();
  closeSheet(event.currentTarget);
}
