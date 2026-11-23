import { createFileRoute } from "@tanstack/react-router";
import { meta, PageHeader, Prose } from "@/components/site-chrome";

export const Route = createFileRoute("/ai-research")({
  head: () => meta("AI & Research — The Human Perspective Project", "A plain-language guide to AI research, model evaluation, and model training, and how they differ."),
  component: () => (
    <>
      <PageHeader eyebrow="AI & Research" title="Research, evaluation, and training — in plain language">
        These are three different things. You can agree to one without agreeing to the others.
      </PageHeader>
      <Prose>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["Research analysis", "People on the research team read and study contributions to understand patterns in language and experience. No AI system learns from it."],
            ["Model evaluation", "We test how well an existing AI model understands examples. It's like giving the model a quiz. The model does not keep or learn from what it sees."],
            ["Model training", "Examples are used to change how a model behaves, so it learns from them. This is permanent for that model version — it's the most significant use."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-border bg-card p-6"><h3 className="text-lg text-primary">{t}</h3><p className="mt-2 text-sm text-muted-foreground">{d}</p></div>
          ))}
        </div>
        <h2>Our initial model focus: Qwen</h2>
        <p>Our first research work examines Qwen, an openly available family of AI language models. Studying an open model lets us evaluate it transparently.</p>
        <p><strong>Your contribution is never sent to Qwen or any AI service automatically.</strong> Every contribution is first reviewed by a person, stripped of identifying details, and only used for the specific purposes you agreed to.</p>
        <h2>Evaluation and training are always separate</h2>
        <p>We keep evaluation and training material in separate datasets, and ask for separate permission for each. Saying yes to evaluation never means yes to training.</p>
      </Prose>
    </>
  ),
});
