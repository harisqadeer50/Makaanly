import { Link } from 'react-router-dom';
import LegalPage from '../../components/layout/LegalPage';
import { useSeo } from '../../hooks/useSeo';

export default function Safety() {
  useSeo({ title: 'Safety tips', description: 'How to search, view and pay safely when buying, renting or listing property.' });
  return (
    <LegalPage title="Safety tips" intro="Most listings and listers are genuine, but property is a big decision. A few habits keep you protected.">
      <section><h2>When you are buying or renting</h2>
        <ul>
          <li><strong>Never pay before you have seen the property and the documents.</strong> Be wary of anyone who asks for a booking fee, token money or a deposit by transfer before a viewing.</li>
          <li><strong>Check ownership.</strong> Ask to see the ownership documents and the lister's identity, and confirm them with the relevant land records office or a lawyer before you pay.</li>
          <li><strong>Compare the price.</strong> A price far below similar properties nearby is a warning sign.</li>
          <li><strong>Use the messages on Makaanly</strong> to keep a record of what was agreed.</li>
          <li><strong>Get agreements in writing</strong>, and read them before you sign.</li>
        </ul></section>
      <section><h2>When you go to a viewing</h2>
        <ul>
          <li>Go in daylight if you can, tell someone where you are going, and take a friend or family member.</li>
          <li>Meet at the property, and confirm the address and the time before you set out.</li>
          <li>Do not carry large amounts of cash.</li>
        </ul></section>
      <section><h2>When you are listing</h2>
        <ul>
          <li>Keep "Hide my exact address" on until you are ready to share it with someone you trust.</li>
          <li>Be careful with anyone who wants to pay more than the asking price, pay by cheque you must refund, or never wants to meet.</li>
          <li>Do not share your ID, bank or card details through messages.</li>
        </ul></section>
      <section><h2>Spotting a fake listing</h2>
        <ul>
          <li>Photos that look like they come from a catalogue or another website.</li>
          <li>Pressure to decide or pay quickly, or a lister who avoids a viewing.</li>
          <li>Requests to move the conversation to another app, or to pay outside Makaanly.</li>
        </ul>
        <p className="mt-3">If something feels wrong, use <strong>Report this listing</strong> on the property page. Our team reviews every report. Questions? Visit <Link to="/support">support</Link>.</p></section>
    </LegalPage>
  );
}
