import { createFileRoute, Link } from "@tanstack/react-router";
import { meta, PageHeader } from "@/components/site-chrome";
import { CONTRIBUTION_TYPES, TYPE_INFO } from "@/lib/contribution-rules";
import { getSubmissionStatus } from "@/lib/contribute.functions";

export const Route = createFileRoute("/contribute")({
  head: () => meta("Contribute — The Human Perspective Project", "Four ways for Black adults to share words, voice, culture, and perspectives on AI — with consent at every step."),
  loader: () => getSubmissionStatus(),
  component: Contribute,
});

const types = CONTRIBUTION_TYPES.map((t) => TYPE_INFO[t]);

function Contribute() {
  const { open } = Route.useLoaderData();
  return (
    <>
      <PageHeader eyebrow="Contribute" title="Share your perspective, on your terms">
        No account needed. Open to Black adults aged 18 and older.
      </PageHeader>
      <div className="mx-auto max-w-5xl px-5 py-14">
        {open ? null : <div role="status" className="rounded-lg border border-primary/30 bg-secondary/50 p-6">
          <p className="font-semibold text-primary">Contributions open soon</p>
          <p className="mt-1 text-sm text-foreground/80">We're finishing and testing our consent, privacy, and withdrawal tools before accepting any submissions.</p>
        </div>}
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {types.map((t) => (
            <Link key={t.slug} to="/contribute/$type" params={{ type: t.slug }} className="block rounded-lg border border-border bg-card p-7 transition-colors hover:border-primary/50">
              <h2 className="text-xl text-primary">{t.title}</h2>
              <p className="mt-2 text-muted-foreground">{t.blurb}</p>
              <p className="mt-4 text-sm font-medium text-primary">Preview the form →</p>
            </Link>
          ))}
        </div>
        <h2 className="mt-16 text-2xl text-primary">What to expect</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-foreground/85">
          <li>Choose a contribution type.</li>
          <li>Pick, one by one, which uses you allow. Every option starts unchecked.</li>
          <li>Receive a private withdrawal reference so you can remove your contribution later.</li>
        </ol>
        <Link to="/privacy" className="mt-8 inline-block font-medium text-primary underline underline-offset-4">Read Privacy & Consent</Link>
      </div>
    </>
  );
}
