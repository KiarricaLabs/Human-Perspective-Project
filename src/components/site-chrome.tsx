import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const nav = [
  { to: "/about", label: "About the Research" },
  { to: "/about-the-researcher", label: "The Researcher" },
  { to: "/ai-research", label: "AI & Research" },
  { to: "/contribute", label: "Contribute" },
  { to: "/privacy", label: "Privacy & Consent" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-border bg-background/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link to="/" className="font-display text-lg font-semibold text-primary">
          The Human Perspective Project
        </Link>
        <Button variant="outline"
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm xl:hidden"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </Button>
        <nav className="hidden gap-4 text-sm xl:flex" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="text-foreground/80 hover:text-primary" activeProps={{ className: "text-primary font-semibold" }}>
              {n.label}
            </Link>
          ))}
          <Link to={signedIn ? "/admin" : "/auth"} className="text-primary">{signedIn ? "Workspace" : "Team sign in"}</Link>
        </nav>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-border px-5 py-3 xl:hidden" aria-label="Mobile">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="py-2 text-foreground/90">
              {n.label}
            </Link>
          ))}
          <Link to={signedIn ? "/admin" : "/auth"} onClick={() => setOpen(false)} className="py-2 text-primary">{signedIn ? "Workspace" : "Team sign in"}</Link>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-3">
        <div>
          <p className="font-display text-lg">The Human Perspective Project</p>
          <p className="mt-2 text-sm opacity-80">Black voices. Human experiences. The future of AI.</p>
        </div>
        <p className="text-sm opacity-80">
          An independent, Black woman-led research initiative. Not funded, sponsored, or operated by a major technology company.
        </p>
        <div className="flex flex-col gap-1 text-sm">
          <Link to="/privacy" className="underline-offset-4 hover:underline">Privacy & Consent</Link>
          <Link to="/participation" className="underline-offset-4 hover:underline">Manage participation</Link>
          <Link to="/ownership" className="underline-offset-4 hover:underline">Ownership & Licensing</Link>
          <Link to="/contact" className="underline-offset-4 hover:underline">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="border-b border-border bg-secondary/40">
      <div className="mx-auto max-w-4xl px-5 py-16 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-4 text-4xl text-primary md:text-5xl">{title}</h1>
        {children && <div className="mt-6 max-w-2xl text-lg text-muted-foreground">{children}</div>}
      </div>
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-3xl space-y-6 px-5 py-14 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:text-primary [&_li]:ml-5 [&_li]:list-disc">{children}</div>;
}

export function meta(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
