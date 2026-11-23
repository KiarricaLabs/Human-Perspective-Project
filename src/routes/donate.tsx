import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { meta, PageHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDonationSession } from "@/lib/donate.functions";

export const Route = createFileRoute("/donate")({
  head: () => meta("Support the research — The Human Perspective Project", "Help fund books, researchers, hosting, and technology development."),
  component: Donate,
});

function Donate() {
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const create = useServerFn(createDonationSession);
  const items = [
    { t: "Books & materials", d: "Reading, references, and study materials that inform the research." },
    { t: "Paying researchers", d: "Fair compensation for the people doing this work." },
    { t: "Hosting & infrastructure", d: "Servers, storage, and the tools that keep the platform running." },
    { t: "Research & technology development", d: "Building and improving the systems that power consent, privacy, and analysis — made for us, by us." },
  ];
  async function checkout() {
    setBusy(true); setErr("");
    try {
      const { url } = await create({ data: Number(amount) || 25 });
      if (url) window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader eyebrow="Support" title="Support the research">
        Your contribution helps keep this work independent and community-centered.
      </PageHeader>
      <div className="mx-auto max-w-4xl px-5 py-12">
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((i) => (
            <div key={i.t} className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-xl text-primary">{i.t}</h2>
              <p className="mt-2 text-muted-foreground">{i.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-sm font-medium" htmlFor="amount">Amount (USD)</label>
            <Input id="amount" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-32" />
          </div>
          <Button onClick={checkout} disabled={busy}>{busy ? "Redirecting…" : "Donate with Stripe"}</Button>
        </div>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        <p className="mt-6 text-sm text-muted-foreground">
          Secure checkout powered by Stripe. Add your Stripe keys to .env to enable.
        </p>
        <Link to="/" className="mt-6 inline-block font-medium text-primary underline underline-offset-4">Back home</Link>
      </div>
    </>
  );
}
