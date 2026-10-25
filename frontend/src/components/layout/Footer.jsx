import { Link } from 'react-router-dom';
import Logo from '../common/Logo';
import { site } from '../../config/site';

const cols = [
  { title: 'Explore', links: [['Buy', '/properties?purpose=sale'], ['Rent', '/properties?purpose=rent'], ['Commercial', '/properties?type=commercial,office,shop'], ['Agents', '/agents']] },
  { title: 'Company', links: [['List your property', '/dashboard/properties/new'], ['Support', '/support'], ['Safety tips', '/safety']] },
  { title: 'Legal', links: [['Privacy policy', '/privacy'], ['Terms of use', '/terms']] },
];

export default function Footer() {
  return (
    <footer className="mt-20 bg-navy-900 text-navy-100">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo light />
          <p className="mt-3 max-w-xs text-sm text-navy-200">Find a place you'll love to call home.</p>
          <p className="mt-3 text-sm"><a href={`mailto:${site.supportEmail}`} className="text-navy-200 hover:text-white">{site.supportEmail}</a>{site.supportPhone && <> · <a href={`tel:${site.supportPhone}`} className="text-navy-200 hover:text-white">{site.supportPhone}</a></>}</p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-sans text-sm font-semibold text-white">{c.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map(([label, to]) => <li key={label}><Link to={to} className="text-navy-200 hover:text-white">{label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-navy-700 py-5 text-center text-xs text-navy-300">© {new Date().getFullYear()} Makaanly. All rights reserved.</div>
    </footer>
  );
}
