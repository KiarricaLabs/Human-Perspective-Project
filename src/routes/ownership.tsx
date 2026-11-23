import { createFileRoute } from "@tanstack/react-router";
import { meta, PageHeader, Prose } from "@/components/site-chrome";

export const Route = createFileRoute("/ownership")({
  head: () => meta("Ownership & Licensing — The Human Perspective Project", "Preliminary ownership, licensing and distribution principles: your contributions stay yours, and every use follows your consent."),
  component: () => (
    <>
      <PageHeader eyebrow="Ownership & Licensing" title="Preliminary ownership, licensing & distribution principles">Distribution strategy: hybrid.</PageHeader>
      <Prose>
        <h2>Ownership philosophy</h2>
        <p>The Human Perspective Project will maintain independent control over its original research infrastructure, proprietary software, branding, evaluation systems, and HPP-developed technology, subject to applicable third-party rights and agreements.</p>
        <p>Participant contributions will remain subject to the rights of their respective contributors and the specific permissions granted through informed consent. Participation does not automatically transfer ownership of original contributions to HPP.</p>
        <h2>Model distribution</h2>
        <p>HPP intends to distribute its technology through a hybrid model consisting of:</p>
        <ol>
          <li>HPP-hosted model access through an authenticated website and API.</li>
          <li>Controlled licensing arrangements for approved research institutions, organizations, and commercial partners.</li>
          <li>Selective downloadable research releases when legally and technically appropriate.</li>
          <li>Private institutional deployments under separate agreements.</li>
        </ol>
        <h2>Research asset protection</h2>
        <p>Raw participant contributions, audio recordings, restricted datasets, internal annotations, unreleased model weights, and confidential research infrastructure will not be publicly distributed by default.</p>
        <h2>Licensing principles</h2>
        <p>All model access, institutional partnerships, and research material distribution will be governed by appropriate licensing agreements. HPP will respect the licenses of underlying models, third-party software, and other incorporated materials.</p>
        <h2>Participant rights and consent</h2>
        <p>Research analysis, audio processing, transcription, AI evaluation, model training, and public use of de-identified excerpts will remain separate permissions. HPP will not treat permission for one purpose as authorization for another.</p>
        <h2>Independence</h2>
        <p>HPP will maintain independent control over its research direction, partnerships, and distribution decisions. External partnerships will not automatically confer ownership or unrestricted access to HPP's research assets.</p>
        <p><em>This is a preliminary organizational policy, not a substitute for executed legal agreements or a determination of intellectual-property ownership.</em></p>
      </Prose>
    </>
  ),
});
