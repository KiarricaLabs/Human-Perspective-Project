import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { meta, PageHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ ...meta("Team sign in — The Human Perspective Project", "Sign in for the research team."), meta: [...meta("Team sign in — The Human Perspective Project", "Sign in for the research team.").meta, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setErr("Sign in failed. Check your email and password.");
    nav({ to: "/admin" });
  }
  return (
    <>
      <PageHeader eyebrow="Research team" title="Team sign in">There is no public sign-up. Accounts are created by the project.</PageHeader>
      <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4 px-5 py-12">
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={async () => { setBusy(true); const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth` } }); if (error) { setErr(error.message); setBusy(false); } }}>Sign in with Google</Button>
        <Link to="/set-password" className="block text-sm text-primary underline">Set or reset your password</Link>
      </form>
    </>
  );
}
