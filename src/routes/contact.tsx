import { createFileRoute } from "@tanstack/react-router";
import { meta, PageHeader, Prose } from "@/components/site-chrome";

export const Route = createFileRoute("/contact")({
  head: () => meta("Contact — The Human Perspective Project", "Questions about the research, participation, or collaboration."),
  component: () => (
    <>
      <PageHeader eyebrow="Contact" title="Get in touch">
        Questions about the research, participation, or collaborating as a researcher or developer.
      </PageHeader>
      <Prose>
        <p>Email: <a className="text-primary underline underline-offset-4" href="mailto:hello@humanperspectiveproject.org">hello@humanperspectiveproject.org</a></p>
        <p className="text-sm text-muted-foreground">Please don't send contributions by email — use the Contribute page once submissions open.</p>
      </Prose>
    </>
  ),
});
