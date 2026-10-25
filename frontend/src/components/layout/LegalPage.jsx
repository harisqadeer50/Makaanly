import { site } from '../../config/site';

// A readable layout for long text pages.
export default function LegalPage({ title, intro, children }) {
  return (
    <div className="container-page py-12">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-stone-500">Last updated {site.legalUpdated}</p>
        {intro && <p className="mt-6 text-lg leading-relaxed text-stone-700">{intro}</p>}
        <div className="mt-8 space-y-8 leading-relaxed text-stone-700 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:text-navy-900 [&_a]:text-sage-600 [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">{children}</div>
      </article>
    </div>
  );
}
