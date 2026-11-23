import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, meta } from '@/components/site-chrome';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export const Route = createFileRoute('/set-password')({
 head: () => ({ meta: [...meta('Set team password — The Human Perspective Project', 'Accept a research team invitation or reset your password.').meta, { name: 'robots', content: 'noindex' }] }),
 component: SetPassword,
});
function SetPassword() {
 const navigate = useNavigate();
 const [ready, setReady] = useState(false); const [checking, setChecking] = useState(true);
 const [password, setPassword] = useState(''); const [again, setAgain] = useState(''); const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
 useEffect(() => { let active = true; void supabase.auth.getSession().then(({ data, error }) => { if (!active) return; setReady(!error && !!data.session); setChecking(false); }).catch(() => { if (active) { setChecking(false); setMessage('The invitation could not be verified. Request a new password link.'); } }); return () => { active = false; }; }, []);
 async function save(e: React.FormEvent) {
  e.preventDefault(); setMessage(''); if (password.length < 12 || password !== again) { setMessage('Use at least 12 characters and make sure both passwords match.'); return; }
  setBusy(true); try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; await navigate({ to: '/admin', replace: true }); } catch { setMessage('Your password could not be saved. Request a fresh password link.'); } finally { setBusy(false); }
 }
 async function send(e: React.FormEvent) {
  e.preventDefault(); setBusy(true); try { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/set-password` }); setMessage(error ? `The link could not be sent: ${error.message}` : 'If this email has a team account, a password link will be sent.'); } catch { setMessage('The link could not be sent. Please try again.'); } finally { setBusy(false); }
 }
 return <><PageHeader eyebrow="Research team" title="Set your password" /><div className="mx-auto max-w-sm space-y-5 px-5 py-12">{checking ? <p role="status">Checking invitation…</p> : ready ? <form onSubmit={save} className="space-y-4"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required /><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" minLength={12} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /><Button disabled={busy}>Save password</Button></form> : <form onSubmit={send} className="space-y-4"><p>Open your invitation or password email link. If it expired, request a new password link here.</p><Label htmlFor="team-email">Team email</Label><Input id="team-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><Button disabled={busy}>Send password link</Button></form>}{message && <p role="status">{message}</p>}</div></>;
}
