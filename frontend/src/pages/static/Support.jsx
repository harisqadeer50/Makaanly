import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { site } from '../../config/site';
import { FAQ } from '../../content/faq';
import { useSeo } from '../../hooks/useSeo';

export default function Support() {
  useSeo({ title: 'Support', description: 'Get help with Makaanly: answers to common questions and how to contact us.' });
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">Support</h1>
        <p className="mt-3 text-lg text-stone-700">Find an answer below, or get in touch.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a href={`mailto:${site.supportEmail}`} className="flex items-center gap-3 rounded-card bg-white p-4 shadow-card hover:shadow-lg"><Mail className="h-5 w-5 text-sage-600" aria-hidden="true" /><span><span className="block text-sm text-stone-500">Email</span><span className="font-medium">{site.supportEmail}</span></span></a>
          {site.supportPhone && <a href={`tel:${site.supportPhone}`} className="flex items-center gap-3 rounded-card bg-white p-4 shadow-card hover:shadow-lg"><Phone className="h-5 w-5 text-sage-600" aria-hidden="true" /><span><span className="block text-sm text-stone-500">Phone</span><span className="font-medium">{site.supportPhone}</span></span></a>}
        </div>
        <p className="mt-4 text-sm text-stone-500">Please include the listing's reference ID (it looks like GF-ABC1234) if your question is about a property. For safety advice, see our <Link to="/safety" className="underline">safety tips</Link>.</p>
        <h2 className="mb-4 mt-10 text-2xl font-semibold">Common questions</h2>
        <div className="divide-y divide-stone-200 rounded-card bg-white shadow-card">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4"><summary className="cursor-pointer list-none font-medium after:float-right after:text-stone-500 after:content-['+'] group-open:after:content-['−']">{q}</summary><p className="mt-2 leading-relaxed text-stone-700">{a}</p></details>
          ))}
        </div>
      </div>
    </div>
  );
}
