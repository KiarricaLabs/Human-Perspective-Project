import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { meta, PageHeader } from "@/components/site-chrome";
import { ContributionForm } from "@/components/contribution-form";
import { TYPE_INFO, typeFromSlug } from "@/lib/contribution-rules";
import { getConsentWording, getSubmissionStatus } from "@/lib/contribute.functions";

export const Route = createFileRoute("/contribute_/$type")({
  loader: async ({ params }) => {
    const type = typeFromSlug(params.type);
    if (!type) throw notFound();
    const [wording, status] = await Promise.all([getConsentWording(), getSubmissionStatus()]);
    return { type, wording, open: status.open };
  },
  head: ({ loaderData }) => {
    const info = loaderData ? TYPE_INFO[loaderData.type] : null;
    return meta(`${info?.title ?? "Contribute"} — The Human Perspective Project`, info?.blurb ?? "Share your perspective with consent at every step.");
  },
  notFoundComponent: () => <div className="mx-auto max-w-3xl px-5 py-20"><p>That contribution type doesn't exist.</p><Link to="/contribute" className="text-primary underline">Back to Contribute</Link></div>,
  component: TypePage,
});

function TypePage() {
  const { type, wording, open } = Route.useLoaderData();
  const info = TYPE_INFO[type];
  return (
    <>
      <PageHeader eyebrow="Contribute" title={info.title}>{info.blurb}</PageHeader>
      <div className="mx-auto max-w-3xl px-5 py-12">
        {!open && (
          <div role="status" className="mb-8 rounded-lg border border-primary/30 bg-secondary/50 p-5">
            <p className="font-semibold text-primary">Preview — not accepting submissions yet</p>
            <p className="mt-1 text-sm text-foreground/80">You can look through the form, but nothing can be sent until our consent, privacy and withdrawal tools are fully tested.</p>
          </div>
        )}
        <ContributionForm type={type} wording={wording} mode="public" open={open} />
      </div>
    </>
  );
}
