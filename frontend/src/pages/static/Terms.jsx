import { Link } from 'react-router-dom';
import LegalPage from '../../components/layout/LegalPage';
import { useSeo } from '../../hooks/useSeo';
import { site } from '../../config/site';

export default function Terms() {
  useSeo({ title: 'Terms of use', description: 'The rules for using Makaanly as a buyer, tenant, owner or agent.' });
  return (
    <LegalPage title="Terms of use" intro={`By creating an account or using Makaanly you agree to these terms. ${site.companyName} runs the service.`}>
      <section><h2>What Makaanly is</h2>
        <p>Makaanly is a marketplace where owners and agents advertise properties and people search for them. We are not a party to any sale, rental or other agreement between users, and we do not own, inspect or guarantee any property.</p></section>
      <section><h2>Your account</h2>
        <ul>
          <li>Give accurate information and keep your password private. You are responsible for what happens under your account.</li>
          <li>You must verify your email address before you can list a property or contact a lister.</li>
          <li>You must be old enough to enter a binding contract where you live.</li>
        </ul></section>
      <section><h2>Listings</h2>
        <ul>
          <li>Only list a property you own or are authorised to advertise, and keep the details, price, availability and photos accurate and current.</li>
          <li>Only upload photos you have the right to use. Do not include contact details or links in photos or descriptions.</li>
          <li>We review listings before they appear and may reject, pause, remove or edit a listing that breaks these terms, is misleading, or is reported and found to be a problem. If we do, we tell you why.</li>
          <li>Being "verified" means our review team checked the documents you provided. It is not a guarantee of any property or person.</li>
        </ul></section>
      <section><h2>Messages and viewings</h2>
        <p>Use messages and viewing requests only for genuine enquiries about a property. Do not spam, harass or deceive anyone. Keep to the viewing times you agree, and cancel in good time if your plans change.</p></section>
      <section><h2>Not allowed</h2>
        <ul>
          <li>Fake, duplicate or misleading listings, or asking for money before a viewing or agreement.</li>
          <li>Scraping, overloading or attempting to break into the service, or accessing accounts that are not yours.</li>
          <li>Anything unlawful, abusive or discriminatory.</li>
        </ul>
        <p className="mt-3">See our <Link to="/safety">safety tips</Link>, and report suspicious listings with the "Report this listing" button.</p></section>
      <section><h2>Suspending or closing accounts</h2>
        <p>We may suspend or close an account that breaks these terms or puts others at risk. A suspended owner's live listings are paused. You can stop using Makaanly at any time and ask us to delete your account.</p></section>
      <section><h2>Our responsibility</h2>
        <p>We work to keep the service available and accurate, but we provide it "as is". To the extent the law allows, we are not responsible for losses arising from dealings between users, from information in listings, or from the service being unavailable. Nothing here limits any right you have that cannot be limited by law.</p></section>
      <section><h2>Changes and contact</h2>
        <p>We may update these terms and will change the date above when we do; continuing to use the service means you accept the update. Questions? Email <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.</p></section>
    </LegalPage>
  );
}
