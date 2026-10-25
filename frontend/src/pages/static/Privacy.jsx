import LegalPage from '../../components/layout/LegalPage';
import { useSeo } from '../../hooks/useSeo';
import { site } from '../../config/site';

export default function Privacy() {
  useSeo({ title: 'Privacy policy', description: 'What personal information Makaanly collects, why, who sees it, and how long we keep it.' });
  return (
    <LegalPage title="Privacy policy" intro={`${site.companyName} runs Makaanly. This page explains what information we collect, why we collect it, who can see it, and the choices you have.`}>
      <section><h2>What we collect</h2>
        <ul>
          <li><strong>Your account:</strong> name, email address, an optional phone number, an optional profile photo, and your password (stored only as a one-way hash, never in plain text).</li>
          <li><strong>Your listings:</strong> the details and photos you add. The street address and exact map position are shown publicly only if you choose to show them.</li>
          <li><strong>Your messages:</strong> inquiries, replies and viewing requests, including the phone number you choose to include.</li>
          <li><strong>Verification documents:</strong> if you apply to be verified, the identity and ownership or licence documents you upload.</li>
          <li><strong>Technical data:</strong> sign-in cookies, and your IP address in security and server logs.</li>
        </ul></section>
      <section><h2>Who can see it</h2>
        <ul>
          <li><strong>Everyone</strong> can see published listings, with the lister's name and the verified badge if they have one. Agents choose which contact details to publish on their public profile.</li>
          <li><strong>The person you contact</strong> sees your name, email address and any phone number you include in a message or viewing request. They do not see your other details.</li>
          <li><strong>Our review team</strong> can see accounts, listings, reports and verification documents so they can keep the site safe. Their actions are recorded.</li>
          <li><strong>Service providers</strong> process data for us: Cloudinary (photo storage and delivery), our email provider (messages we send you), our database host, and OpenStreetMap (map tiles, which your browser requests directly, so they can see your IP address).</li>
        </ul>
        <p className="mt-3">We do not sell your personal information, and we do not use advertising or tracking cookies.</p></section>
      <section><h2>Verification documents</h2>
        <p>Documents you upload for verification are stored privately and shown only to our review team through short-lived links. <strong>They are deleted as soon as we make a decision</strong> on your request. We keep a record that you applied and the outcome.</p></section>
      <section><h2>Cookies</h2>
        <p>We use cookies only to keep you signed in and to protect your account from forged requests. They are essential to the service, so there is no cookie banner.</p></section>
      <section><h2>How long we keep things</h2>
        <ul>
          <li>Account and listing details: until you ask us to delete them, or we close the account.</li>
          <li>In-app notifications: 180 days.</li>
          <li>Photos of a listing: removed when the listing is deleted.</li>
          <li>Messages and viewing requests: kept with the account so conversations make sense, and removed when the account is deleted.</li>
        </ul></section>
      <section><h2>Your choices</h2>
        <p>You can change your name, phone number and photo in your profile, and turn optional emails off in Settings. To see, correct or delete the information we hold about you, email <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> from the address on your account.</p></section>
      <section><h2>Security</h2>
        <p>Passwords are hashed, sessions use secure cookies, and the connection to the site is encrypted. No system is perfectly secure, so please use a strong, unique password.</p></section>
      <section><h2>Changes and contact</h2>
        <p>If we change this policy we will update the date above. Questions? Email <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.{site.address ? ` ${site.companyName}, ${site.address}.` : ''}</p></section>
    </LegalPage>
  );
}
