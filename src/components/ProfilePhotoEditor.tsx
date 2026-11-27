import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, RotateCcw, RotateCw } from 'lucide-react';
import { clampPhotoCrop, encodeProfileCrop, INITIAL_PHOTO_CROP, photoCropGeometry, photoObjectUrl } from '../services/profilePhoto';

export default function ProfilePhotoEditor({ source, onCancel, onSave }: {
  source: File | string; onCancel: () => void; onSave: (photo: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const saving = useRef(false);
  const [url, setUrl] = useState('');
  const [ready, setReady] = useState(false);
  const [crop, setCrop] = useState(INITIAL_PHOTO_CROP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    let temporary: string | undefined;
    try { setUrl(typeof source === 'string' ? source : (temporary = photoObjectUrl(source))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open this photo.'); }
    return () => { if (temporary) URL.revokeObjectURL(temporary); };
  }, [source]);

  const image = ready ? imageRef.current : null;
  const geometry = image && photoCropGeometry(image, crop);
  const move = (dx: number, dy: number, factor: number, stageEdge: number, pivotX: number, pivotY: number) => {
    if (!image || !stageEdge) return;
    setCrop(current => {
      const { width, height, edge } = photoCropGeometry(image, current);
      const zoom = Math.max(1, Math.min(8, current.zoom * factor));
      const change = edge * (1 - current.zoom / zoom);
      return clampPhotoCrop(image, { ...current, zoom,
        x: current.x + (pivotX * change - dx * edge / stageEdge) / width,
        y: current.y + (pivotY * change - dy * edge / stageEdge) / height });
    });
  };

  const confirm = async () => {
    if (!image || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const encoded = encodeProfileCrop(image, crop);
      dialog.current?.close();
      await onSave(encoded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the crop.');
      if (dialog.current?.isConnected && !dialog.current.open) dialog.current.showModal();
    }
    finally { saving.current = false; setBusy(false); }
  };

  return <dialog ref={dialog} className="profile-crop-editor lifeos-page" data-profile-editor aria-label="Crop profile photo"
    onCancel={event => { event.preventDefault(); if (!saving.current) onCancel(); }}>
    <header className="profile-crop-toolbar">
      <h2>Crop photo</h2>
      <button type="button" className="profile-crop-cancel" disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="button" className="feather-icon-button" aria-label="Reset crop" title="Reset crop" disabled={busy || !image} onClick={() => setCrop(INITIAL_PHOTO_CROP)}><RotateCcw size={19} aria-hidden="true" /></button>
      <button type="button" className="feather-icon-button" aria-label="Rotate photo clockwise" title="Rotate photo clockwise" disabled={busy || !image}
        onClick={() => image && setCrop(current => clampPhotoCrop(image, { ...current, x: 1 - current.y, y: current.x, turns: (current.turns + 1) % 4 }))}><RotateCw size={19} aria-hidden="true" /></button>
      <button type="button" className="feather-primary" disabled={busy || !image} onClick={() => void confirm()}>{busy ? 'Saving…' : 'Done'}</button>
    </header>
    <div className="profile-crop-preview">
    <div className="profile-crop-stage" onPointerDown={event => {
      if (busy || !ready || points.current.size >= 2) return;
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      const previous = points.current.get(event.pointerId);
      if (!previous) return;
      const current = { x: event.clientX, y: event.clientY };
      const other = [...points.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
      const rect = event.currentTarget.getBoundingClientRect();
      const before = other ? Math.hypot(previous.x - other.x, previous.y - other.y) : 0;
      const after = other ? Math.hypot(current.x - other.x, current.y - other.y) : 0;
      const split = other ? 2 : 1;
      const pivotX = (other ? (previous.x + other.x) / 2 : previous.x) - rect.left;
      const pivotY = (other ? (previous.y + other.y) / 2 : previous.y) - rect.top;
      move((current.x - previous.x) / split, (current.y - previous.y) / split,
        before > 2 ? after / before : 1, rect.width, pivotX / rect.width - .5, pivotY / rect.width - .5);
      points.current.set(event.pointerId, current);
    }} onLostPointerCapture={event => points.current.delete(event.pointerId)}>
      {url && <img ref={imageRef} src={url} alt="" draggable={false} onLoad={event => {
        const photo = event.currentTarget;
        if (!photo.naturalWidth || !photo.naturalHeight || photo.naturalWidth * photo.naturalHeight > 50_000_000) {
          setError('Choose a smaller photo.'); return;
        }
        setReady(true);
      }} onError={() => setError('That photo could not be read.')} style={geometry && image ? {
        width: image.naturalWidth / geometry.edge * 100 + '%',
        left: (50 + (.5 - crop.x) * geometry.width / geometry.edge * 100) + '%',
        top: (50 + (.5 - crop.y) * geometry.height / geometry.edge * 100) + '%',
        transform: 'translate(-50%, -50%) rotate(' + crop.turns * 90 + 'deg)',
      } : { visibility: 'hidden' }} />}
    </div>
    </div>
    {error && <p role="alert" className="profile-crop-error">{error}</p>}
    <details className="profile-crop-adjust">
      <summary>Fine adjustments <ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="profile-crop-adjust-controls">
        <label>Zoom <input type="range" min="1" max="8" step=".05" value={crop.zoom} disabled={!image || busy}
          onChange={event => move(0, 0, Number(event.target.value) / crop.zoom, 1, 0, 0)} /></label>
        <div role="group" aria-label="Move photo">{([['left', ArrowLeft, -1, 0], ['right', ArrowRight, 1, 0], ['up', ArrowUp, 0, -1], ['down', ArrowDown, 0, 1]] as const).map(([direction, Icon, x, y]) =>
          <button type="button" className="feather-icon-button" aria-label={'Move photo ' + direction} key={direction} disabled={!image || busy}
            onClick={() => move(x * .06, y * .06, 1, 1, 0, 0)}><Icon size={17} aria-hidden="true" /></button>)}</div>
      </div>
    </details>
  </dialog>;
}
