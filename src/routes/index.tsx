import { createFileRoute, Link } from "@tanstack/react-router";
import { meta } from "@/components/site-chrome";
import { getSubmissionStatus } from "@/lib/contribute.functions";

export const Route = createFileRoute("/")({
  head: () => meta("The Human Perspective Project — Black voices in AI research", "An independent, Black woman-led research initiative on Black language, cultural knowledge, lived experience, and AI."),
  loader: () => getSubmissionStatus(),
  component: Index,
});

const pillars = [
  { t: "Share Your Words", d: "Written reflections, stories, and everyday language in your own voice." },
  { t: "Share Your Voice", d: "Optional audio contributions, stored privately and only with your consent." },
  { t: "Language & Culture", d: "Expressions, meanings, and knowledge that shape how we communicate." },
  { t: "AI & Society", d: "Your experiences with, and perspectives on, artificial intelligence." },
];

function Index() {
  const { open } = Route.useLoaderData();
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pt-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Independent research initiative</p>
        <h1 className="mt-6 max-w-4xl text-4xl leading-[1.05] text-primary md:text-6xl">
          Black voices. Human experiences. The future of AI.
        </h1>
        <p className="mt-8 max-w-2xl text-lg text-muted-foreground">
          The Human Perspective Project is an independently founded, Black woman-led research effort studying Black language,
          cultural knowledge, and lived experience — and how AI understands, or misunderstands, them.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/contribute" className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90">Learn how to contribute</Link>
          <Link to="/about" className="rounded-md border border-primary/30 px-6 py-3 font-medium text-primary hover:bg-secondary">About the research</Link>
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
          <div><h2 className="text-2xl text-primary">Independent</h2><p className="mt-3 text-muted-foreground">Not funded, sponsored, or operated by a major technology company.</p></div>
          <div><h2 className="text-2xl text-primary">Community-centered</h2><p className="mt-3 text-muted-foreground">Research centered on Black experiences, perspectives, and interests in the evolving relationship between people and artificial intelligence.</p></div>
          <div><h2 className="text-2xl text-primary">Consent first</h2><p className="mt-3 text-muted-foreground">Every use of your contribution is a separate choice. Nothing is used for AI training unless you say yes.</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl text-primary md:text-4xl">Four ways to take part</h2>
        <p className="mt-3 max-w-xl text-muted-foreground">Open to Black adults aged 18 and older. No account needed.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {pillars.map((p, i) => (
            <div key={p.t} className="rounded-lg border border-border bg-card p-7">
              <span className="font-display text-sm text-accent-foreground">0{i + 1}</span>
              <h3 className="mt-2 text-xl text-primary">{p.t}</h3>
              <p className="mt-2 text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="rounded-lg bg-accent/50 p-8 md:p-12">
          <h2 className="text-2xl text-primary md:text-3xl">{open ? 'Submissions are open' : 'Submissions are not open yet'}</h2>
          <p className="mt-3 max-w-2xl text-foreground/80">
            {open ? 'You can now contribute with consent at every step.' : 'We will only accept contributions once consent, privacy, secure storage, and withdrawal tools have been fully tested. Read how we\'ll protect your participation.'}
          </p>
          <Link to={open ? '/contribute' : '/privacy'} className="mt-6 inline-block font-medium text-primary underline underline-offset-4">{open ? 'Contribute now' : 'Privacy & Consent'}</Link>
        </div>
      </section>
    </>
  );
}
