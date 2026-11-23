import { createFileRoute, Link } from "@tanstack/react-router";
import { meta, PageHeader, Prose } from "@/components/site-chrome";

export const Route = createFileRoute("/privacy")({
  head: () => meta("Privacy & Consent — The Human Perspective Project", "Separate, optional permissions for every use of your contribution, and how to withdraw."),
  component: () => (
    <>
      <PageHeader eyebrow="Privacy & Consent" title="You decide every use">
        Each permission is separate, optional, and starts unchecked.
      </PageHeader>
      <Prose>
        <h2>The permissions you'll be asked for</h2>
        <ul>
          <li><strong>Research analysis</strong> — required to take part; the research team may study your contribution.</li>
          <li><strong>Audio recording or submission</strong> — only if you share audio.</li>
          <li><strong>Transcription</strong> — turning audio into text.</li>
          <li><strong>AI model evaluation</strong> — testing how a model understands examples.</li>
          <li><strong>AI model training or fine-tuning</strong> — asked separately, never bundled with evaluation.</li>
          <li><strong>Public use of excerpts</strong> — reviewed, de-identified quotes only.</li>
        </ul>
        <p>You can contribute without agreeing to AI training or public use.</p>
        <h2>How we protect contributions</h2>
        <ul>
          <li>Raw contributions are never public.</li>
          <li>Audio is kept in private storage.</li>
          <li>Nothing is automatically transcribed, analyzed, sent to AI, or published.</li>
          <li>We record which permissions you gave, when, and under which version of this policy.</li>
        </ul>
        <h2>Withdrawing</h2>
        <p>After submitting you'll receive a private reference. Use it to request removal of your contribution at any time.</p>
        <p><Link to="/participation" className="text-primary underline">Manage your permissions or withdraw</Link></p>
      </Prose>
    </>
  ),
});
