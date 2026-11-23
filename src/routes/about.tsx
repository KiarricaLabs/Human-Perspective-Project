import { createFileRoute, Link } from "@tanstack/react-router";
import { meta, PageHeader, Prose } from "@/components/site-chrome";

export const Route = createFileRoute("/about")({
  head: () => meta("About the Research — The Human Perspective Project", "Why an independent, Black woman-led initiative is studying Black language, culture, and perspectives on AI."),
  component: () => (
    <>
      <PageHeader eyebrow="About the Research" title="Research led from within the community">
        An independently founded initiative led by a Black woman researcher.
      </PageHeader>
      <Prose>
        <p>AI systems learn from text and speech. When Black language, cultural knowledge, and lived experience are missing or misrepresented in that material, the systems built from it can misunderstand the people they're meant to serve.</p>
        <h2>What we study</h2>
        <ul><li>Black language and everyday expression</li><li>Cultural knowledge and meaning</li><li>Lived experiences told in people's own words</li><li>Perspectives on artificial intelligence and its impact</li></ul>
        <h2>Why independence matters</h2>
        <p>The project is not funded, sponsored, or operated by a major technology company. Research priorities are set by the project and its community, not a product roadmap.</p>
        <h2>Who can take part</h2>
        <p>Black adults aged 18 and older. Participation is voluntary, and you choose exactly how your contribution may be used.</p>
        <h2>Building opportunity</h2>
        <p>Beyond the research itself, the project aims to create pathways for Black researchers, developers, engineers, and innovators working in AI.</p>
        <p><Link to="/about-the-researcher">Meet the researcher behind the project →</Link></p>
      </Prose>
    </>
  ),
});
