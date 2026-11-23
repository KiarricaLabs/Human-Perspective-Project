import { createFileRoute } from "@tanstack/react-router";
import { meta, PageHeader, Prose } from "@/components/site-chrome";

export const Route = createFileRoute("/about-the-researcher")({
  head: () => meta("About the Researcher — The Human Perspective Project", "A personal journey from South Georgia to Oakland, and why a Black woman in AI founded The Human Perspective Project."),
  component: Researcher,
});

function Researcher() {
  return (
    <>
      <PageHeader eyebrow="About the Researcher" title="A personal journey. A cultural connection. A question about the future of technology." />
      <Prose>
        <p>I'm Kiarrica Favors, lead researcher of The Human Perspective Project, working with a small team. I'm a Southern-born mother, founder, builder, and AI software engineer. Over the years, life took me to different places, eventually bringing me to the San Francisco Bay Area — a world beyond anything I could have imagined growing up.</p>
        <p>And somewhere along the way, I found something in Oakland that felt familiar.</p>
        <p>The love. The soul. The music. The grit. The creativity. The sense of community. Something about the culture reached a part of me that felt like home, in a way I hadn't experienced anywhere else.</p>
        <p>The longer I lived here, the more I began questioning what it really means to be Black in America, how differently that experience can look depending on where you are, and how much of our culture influences the world around us.</p>
        <p>That curiosity eventually led me to bigger questions.</p>
        <p>How can Black cultural influence be so vast, while Black representation and upward mobility remain so limited in some of the very industries and institutions shaped by that influence?</p>
        <p>The Bay Area is recognized around the world for technology and innovation. Black culture has influenced music, language, fashion, entertainment, creativity, and the way people communicate across the globe. Yet the presence of Black people in the leadership and decision-making spaces of the technology industry has not reflected that influence.</p>
        <p>And the questions don't stop at representation.</p>
        <p>I think about Black communities in Oakland and across California. I think about rural communities in the South, historically Black neighborhoods in New York, and communities throughout the country whose experiences are often missing from conversations about technological advancement.</p>
        <p>I think about environmental conditions, access to infrastructure, digital representation, and the ways Black culture is extracted, reproduced, and sometimes misrepresented online.</p>
        <p>I think about the decisions being made by people developing technologies that will affect all of us.</p>
        <p>Should technology reproduce harmful stereotypes simply because those patterns exist in its training data? Should AI systems mistake cultural expression for aggression, humor for hostility, or unfamiliar language for a lack of intelligence? Should communities have to live with the consequences of technological decisions they had little opportunity to influence?</p>
        <p>And what happens when the people asking those questions aren't represented in the rooms where those decisions are made?</p>
        <p>These aren't abstract questions to me. They connect culture, technology, environment, economics, opportunity, and the future of our communities.</p>
        <h2>Why I started this project</h2>
        <p>My work and education are rooted in artificial intelligence and software engineering. As I continue learning, researching, and building in technology, I've become increasingly interested in the relationship between human experience and the systems we're creating.</p>
        <p>AI is learning from human-generated information every day. But human experience is not one-dimensional, and Black experiences are not interchangeable.</p>
        <p>We are not simply historical references, news articles, social media trends, scraped videos, or a collection of internet stereotypes.</p>
        <p>We are people with distinct histories, regional identities, generations, languages, humor, knowledge, creativity, and lived experiences.</p>
        <p>There is no single Black experience. There is never just one story.</p>
        <p>I created The Human Perspective Project because I believe those stories, perspectives, and cultural knowledge deserve to be approached with greater depth, context, and respect.</p>
        <p>I want to contribute to research that explores how AI understands Black language, how it interprets cultural context, where it gets things wrong, and what more responsible technology could look like.</p>
        <p>But I also want this work to extend beyond the research itself.</p>
        <p>I believe we need more spaces where Black people can participate in technology as researchers, engineers, developers, founders, decision-makers, and innovators — not simply as consumers or subjects of research.</p>
        <h2>What I hope to contribute</h2>
        <p>The Human Perspective Project is independently founded, Black woman-led, and community-centered.</p>
        <p>It is not funded, sponsored, or operated by a major technology company. My motivation is to contribute meaningful research, encourage participation, and help create opportunities for more Black people to have a place in the future of technology.</p>
        <p>I don't claim to speak for every Black person, every community, or every experience. That's precisely why I believe this work matters. We need room for different perspectives rather than assumptions that one voice can represent everyone.</p>
        <p>I want to see technology that is ethical, useful, culturally informed, environmentally responsible, and aligned with the people it serves.</p>
        <p>Technology that doesn't simply learn how to imitate us, but is developed with a deeper understanding of the human beings behind the language, culture, and information it encounters. We are building and improving systems that won't see us as an afterthought — technology made for us, by us.</p>
        <p>Our communities should have a place in shaping the future, not just adapting to decisions made without us.</p>
        <p>And that's why this work matters to me.</p>
      </Prose>
    </>
  );
}
