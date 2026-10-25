import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, EyeOff, MessageSquare, Ruler, Search, ShieldCheck } from 'lucide-react';
import { agentsApi } from '../../services/marketplace';
import { AgentCard } from '../../pages/Agents';
import Button from '../common/Button';
import { FAQ } from '../../content/faq';
import { site } from '../../config/site';

export function Section({ id, title, intro, action, children, className = '' }) {
  return (
    <section className={`container-page py-10 ${className}`} aria-labelledby={id}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h2 id={id} className="text-2xl font-semibold sm:text-3xl">{title}</h2>{intro && <p className="mt-1 max-w-2xl text-stone-500">{intro}</p>}</div>{action}
      </div>
      {children}
    </section>
  );
}

const STEPS = [
  { icon: Search, title: 'Discover properties', text: 'Search by city, price and size in marla or kanal, and save the ones you like.' },
  { icon: MessageSquare, title: 'Contact the owner or agent', text: 'Send a message from the listing and keep the whole conversation in one place.' },
  { icon: CalendarCheck, title: 'Arrange a viewing', text: 'Pick a time that suits you. The owner or agent confirms it, or suggests another.' },
];
export function HowItWorks() {
  return (
    <Section id="how-heading" title="How Makaanly works">
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="rounded-card bg-white p-6 shadow-card">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-sage-100 text-sage-600"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="text-sm font-semibold text-stone-500">Step {i + 1}</span></div>
            <h3 className="mt-4 font-sans text-lg font-semibold">{title}</h3><p className="mt-1 text-stone-600">{text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function FeaturedAgents() {
  const { data } = useQuery({ queryKey: ['agents', 'home'], queryFn: () => agentsApi.list({ limit: 4 }), staleTime: 120000 });
  if (!data?.agents?.length) return null; // shown only when real agents have published a profile
  return (
    <Section id="agents-heading" title="Meet our agents" action={<Link to="/agents" className="text-sm font-medium text-sage-600 hover:underline">All agents</Link>}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.agents.map((a) => <AgentCard key={a.id} agent={a} />)}</ul>
    </Section>
  );
}

const REASONS = [
  { icon: Ruler, title: 'Search the way you measure', text: 'Marla, kanal, square feet and square yards, converted for you.' },
  { icon: EyeOff, title: 'Your address stays private', text: 'Listers choose whether to show an exact address. By default only the neighborhood is public.' },
  { icon: ShieldCheck, title: 'Verified listers', text: 'Owners and agents can be verified after our team checks their documents. The badge shows only once they pass.' },
  { icon: MessageSquare, title: 'Everything in one place', text: 'Messages, viewing requests and notifications live in your dashboard.' },
];
export function WhyChoose() {
  return (
    <Section id="why-heading" title="Why choose Makaanly">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REASONS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-card bg-white p-5 shadow-card"><Icon className="h-6 w-6 text-sage-600" aria-hidden="true" /><h3 className="mt-3 font-sans text-base font-semibold">{title}</h3><p className="mt-1 text-sm text-stone-600">{text}</p></li>
        ))}
      </ul>
    </Section>
  );
}

const SAMPLES = [
  { quote: 'I could filter by marla and see only the neighborhoods I cared about. The viewing request was confirmed the same day.', who: 'Sample buyer, Lahore' },
  { quote: 'Having messages and viewing requests in one place saves me a lot of phone calls.', who: 'Sample agent, Islamabad' },
  { quote: 'I liked that my street address was hidden until I decided to share it.', who: 'Sample owner, Karachi' },
];
// These are examples, not real customers, and the heading says so.
export function Testimonials() {
  if (!site.showDemoTestimonials) return null;
  return (
    <Section id="voices-heading" title="What people could say" intro="Sample testimonials (demonstration content). They are examples, not real customers.">
      <ul className="grid gap-4 md:grid-cols-3">
        {SAMPLES.map(({ quote, who }) => (
          <li key={who}><figure className="h-full rounded-card border border-dashed border-stone-300 bg-white p-5"><blockquote className="text-stone-700">“{quote}”</blockquote><figcaption className="mt-3 text-sm font-medium text-stone-500">{who}</figcaption></figure></li>
        ))}
      </ul>
    </Section>
  );
}

export function Faq() {
  return (
    <Section id="faq-heading" title="Frequently asked questions" action={<Link to="/support" className="text-sm font-medium text-sage-600 hover:underline">More help</Link>}>
      <div className="divide-y divide-stone-200 rounded-card bg-white shadow-card">
        {FAQ.slice(0, 6).map(({ q, a }) => (
          <details key={q} className="group px-5 py-4"><summary className="cursor-pointer list-none font-medium after:float-right after:text-stone-500 after:content-['+'] group-open:after:content-['−']">{q}</summary><p className="mt-2 leading-relaxed text-stone-700">{a}</p></details>
        ))}
      </div>
    </Section>
  );
}

export function ListCta() {
  return (
    <section className="container-page py-10" aria-labelledby="cta-heading">
      <div className="rounded-card bg-navy-900 px-6 py-10 text-center text-white sm:px-12">
        <h2 id="cta-heading" className="text-3xl font-bold">Own or manage a property?</h2>
        <p className="mx-auto mt-2 max-w-xl text-navy-100">List it on Makaanly and reach people who are looking right now.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button as={Link} to="/dashboard/properties/new" variant="accent" size="lg">List your property</Button>
          <Button as={Link} to="/agents" variant="outline" size="lg" className="border-navy-500 bg-transparent text-white hover:bg-navy-800">Find an agent</Button>
        </div>
      </div>
    </section>
  );
}
