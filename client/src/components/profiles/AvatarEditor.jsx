import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function AvatarEditor({ profile, onSaved, onStateChange }) {
  const { updateAvatar } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [needsCleanup, setNeedsCleanup] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const input = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { onStateChange({ busy, draft: Boolean(file) }); }, [busy, file, onStateChange]);

  function discard() {
    setFile(null);
    if (input.current) input.current.value = '';
  }
  function choose(event) {
    setError(null);
    setNotice(null);
    const selected = event.target.files?.[0];
    setFile(null);
    if (!selected) return;
    if (!TYPES.includes(selected.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      event.target.value = '';
    } else if (!selected.size || selected.size > MAX_BYTES) {
      setError(selected.size ? 'Profile pictures must be 2 MB or smaller.' : 'This file is empty. Choose another image.');
      event.target.value = '';
    } else setFile(selected);
  }
  async function save(remove = false) {
    if (pending.current || (!remove && !file)) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateAvatar(remove ? null : file);
      if (!mounted.current) return;
      onSaved(updated);
      discard();
      setNeedsCleanup(false);
      setNotice(remove ? 'Profile picture removed.' : 'Profile picture updated.');
    } catch (err) {
      if (mounted.current) {
        setError(err.message || 'Could not update your profile picture. Please try again.');
        // A lost response can follow a committed upload. Always offer removal
        // so a retry can also clean up an interrupted first upload.
        setNeedsCleanup(true);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <section aria-label="Profile picture" className="border-b border-border pb-5">
      <h3 className="mb-3 text-sm font-medium text-ink">Profile picture</h3>
      <div className="mb-3 flex items-center gap-3">
        {preview ? <img src={preview} alt="Selected profile picture preview" className="h-16 w-16 shrink-0 rounded-full object-cover" /> : <Avatar name={profile.full_name} src={profile.avatar_url} size={16} />}
        <p className="text-xs text-ink-muted">JPG, PNG, or WebP. Up to 2 MB and 16 megapixels.</p>
      </div>
      <label htmlFor="avatar-file" className="sr-only">Choose profile picture</label>
      <input ref={input} id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={choose} className="block w-full min-w-0 text-sm text-ink" aria-describedby="avatar-hint" />
      <div className="mt-3 flex flex-wrap gap-2">
        {file && <>
          <Button type="button" loading={busy} onClick={() => save(false)}>Upload picture</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={discard}>Discard picture</Button>
        </>}
        {(profile.avatar_path || needsCleanup) && <Button type="button" variant="secondary" disabled={busy} onClick={() => save(true)}>Remove picture</Button>}
      </div>
      <p id="avatar-hint" className="mt-2 text-xs text-ink-muted">Picture changes are saved separately from the profile details below.</p>
      {file && <p className="mt-2 text-xs text-ink-muted">Upload or discard this picture before saving profile details.</p>}
      {busy && <p role="status" className="mt-2 text-sm text-ink-muted">Updating profile picture…</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="mt-2 text-sm text-success">{notice}</p>}
    </section>
  );
}
