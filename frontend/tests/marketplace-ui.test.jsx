// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({ current: null, setUser: null }));
vi.mock('../src/context/AuthContext.jsx', () => ({ useAuth: () => auth.current, AuthProvider: ({ children }) => children }));
vi.mock('../src/services/marketplace.js', () => ({
  favoritesApi: { ids: vi.fn(), add: vi.fn(), remove: vi.fn(), list: vi.fn() },
  inquiriesApi: { create: vi.fn(), get: vi.fn(), reply: vi.fn(), setStatus: vi.fn(), sent: vi.fn(), received: vi.fn() },
  appointmentsApi: { create: vi.fn(), mine: vi.fn(), received: vi.fn(), act: vi.fn(), cancel: vi.fn() },
  reportsApi: { create: vi.fn() },
  agentsApi: { saveProfile: vi.fn(), list: vi.fn(), get: vi.fn() },
  usersApi: { update: vi.fn(), uploadAvatar: vi.fn(), removeAvatar: vi.fn() },
  dashboardApi: { summary: vi.fn() },
}));
const api = await import('../src/services/marketplace.js');
const { ToastProvider } = await import('../src/components/common/Toast.jsx');
const { default: FavoriteButton } = await import('../src/components/marketplace/FavoriteButton.jsx');
const { default: InquiryForm } = await import('../src/components/marketplace/InquiryForm.jsx');
const { default: ViewingModal } = await import('../src/components/marketplace/ViewingModal.jsx');
const { default: ReportModal } = await import('../src/components/marketplace/ReportModal.jsx');
const { default: InquiryThread } = await import('../src/pages/dashboard/InquiryThread.jsx');
const { default: Appointments, actionsFor } = await import('../src/pages/dashboard/Appointments.jsx');
const { default: Profile } = await import('../src/pages/dashboard/Profile.jsx');
const { pktDate, addDays, pktToIso } = await import('../src/utils/datetime.js');

const Where = () => { const l = useLocation(); return <output data-testid="url">{l.pathname}{l.search}</output>; };
const renderAt = (ui, url = '/', path = '*') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><MemoryRouter initialEntries={[url]}><Routes><Route path={path} element={ui} /></Routes><Where /></MemoryRouter></ToastProvider></QueryClientProvider>);
};
const url = () => screen.getByTestId('url').textContent;
const asUser = (over = {}) => { auth.setUser = vi.fn(); auth.current = { status: 'authenticated', isAuthenticated: true, setUser: auth.setUser, user: { id: 'u1', name: 'Sam Buyer', email: 'sam@x.com', role: 'buyer', isEmailVerified: true, ...over } }; };
const property = { id: 'p1', title: 'Spacious house in DHA' };

beforeEach(() => {
  asUser();
  api.favoritesApi.ids.mockReset().mockResolvedValue([]);
  api.favoritesApi.add.mockReset().mockResolvedValue({ saved: true });
  api.favoritesApi.remove.mockReset().mockResolvedValue({ saved: false });
});
afterEach(cleanup);

describe('favorite button', () => {
  it('sends guests to log in instead of saving', async () => {
    auth.current = { status: 'guest', isAuthenticated: false, user: null };
    const user = userEvent.setup();
    renderAt(<FavoriteButton propertyId="p1" title="Spacious house" />, '/properties');
    await user.click(screen.getByRole('button', { name: 'Save Spacious house' }));
    expect(url()).toBe('/login'); expect(api.favoritesApi.add).not.toHaveBeenCalled();
    expect(await screen.findByText('Log in to save properties.')).toBeTruthy();
  });

  it('shows the saved state from the server and removes it on click', async () => {
    api.favoritesApi.ids.mockResolvedValue(['p1']);
    const user = userEvent.setup();
    renderAt(<FavoriteButton propertyId="p1" title="Spacious house" />);
    const btn = await screen.findByRole('button', { name: 'Remove Spacious house from saved properties' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    await user.click(btn);
    expect(api.favoritesApi.remove).toHaveBeenCalledWith('p1');
  });

  it('changes at once, before the server answers', async () => {
    api.favoritesApi.add.mockReturnValue(new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    renderAt(<FavoriteButton propertyId="p1" title="Spacious house" />);
    const btn = await screen.findByRole('button', { name: 'Save Spacious house' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    await user.click(btn);
    await waitFor(() => expect(screen.getByRole('button', { name: /Remove Spacious house/ }).getAttribute('aria-pressed')).toBe('true'));
  });

  it('rolls back and explains when the server refuses', async () => {
    api.favoritesApi.add.mockRejectedValue({ message: 'You can save up to 200 properties.' });
    const user = userEvent.setup();
    renderAt(<FavoriteButton propertyId="p1" title="Spacious house" />);
    await user.click(await screen.findByRole('button', { name: 'Save Spacious house' }));
    expect(await screen.findByText('You can save up to 200 properties.')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Spacious house' }).getAttribute('aria-pressed')).toBe('false'));
  });

  it('never triggers the card link it sits on', async () => {
    const outer = vi.fn((e) => e.preventDefault());
    const user = userEvent.setup();
    renderAt(<a href="/properties/x" onClick={outer}><FavoriteButton propertyId="p1" title="Spacious house" /></a>);
    await user.click(await screen.findByRole('button', { name: 'Save Spacious house' }));
    expect(outer).not.toHaveBeenCalled();
  });
});

describe('inquiry form', () => {
  it('checks the message before sending anything', async () => {
    const user = userEvent.setup();
    renderAt(<InquiryForm property={property} />);
    const box = screen.getByLabelText('Your message');
    await user.clear(box); await user.type(box, 'hi');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByText('Write at least 10 characters')).toBeTruthy();
    expect(api.inquiriesApi.create).not.toHaveBeenCalled();
  });

  it('sends the listing id and message (never a recipient) and links to the conversation', async () => {
    api.inquiriesApi.create.mockResolvedValue({ inquiry: { id: 'inq9' } });
    const user = userEvent.setup();
    renderAt(<InquiryForm property={property} />);
    await user.type(screen.getByLabelText(/Phone/), '0300 1112223');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(api.inquiriesApi.create).toHaveBeenCalledWith({ propertyId: 'p1', message: expect.stringContaining('Spacious house in DHA'), phone: '0300 1112223' });
    expect(await screen.findByText(/Your message has been sent/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open conversation' }).getAttribute('href')).toBe('/dashboard/inquiries/inq9');
  });

  it('points to the existing conversation when one is already open', async () => {
    api.inquiriesApi.create.mockRejectedValue({ code: 'INQUIRY_EXISTS', message: 'x', errors: [{ field: 'inquiryId', message: 'abc123' }] });
    const user = userEvent.setup();
    renderAt(<InquiryForm property={property} />);
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText(/already have a conversation/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open conversation' }).getAttribute('href')).toBe('/dashboard/inquiries/abc123');
  });

  it('shows server field errors next to the field', async () => {
    api.inquiriesApi.create.mockRejectedValue({ message: 'Please check', errors: [{ field: 'phone', message: 'Enter a valid phone number' }] });
    const user = userEvent.setup();
    renderAt(<InquiryForm property={property} />);
    await user.type(screen.getByLabelText(/Phone/), '12');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Enter a valid phone number')).toBeTruthy();
  });
});

describe('viewing request', () => {
  const pick = async (user, { date = addDays(pktDate(), 3), time = '10:00' } = {}) => {
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: date } });
    await user.selectOptions(screen.getByLabelText(/Start time/), time);
    return date;
  };

  it('needs a date and time first', async () => {
    const user = userEvent.setup();
    renderAt(<ViewingModal open onClose={() => {}} property={property} />);
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByText('Choose a date and a start time')).toBeTruthy();
    expect(api.appointmentsApi.create).not.toHaveBeenCalled();
  });

  it('sends the chosen Pakistan time as UTC, with the length', async () => {
    api.appointmentsApi.create.mockResolvedValue({ appointment: { id: 'a1', start: '2030-01-05T05:00:00.000Z', end: '2030-01-05T05:30:00.000Z' } });
    const user = userEvent.setup();
    renderAt(<ViewingModal open onClose={() => {}} property={property} />);
    const date = await pick(user);
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(api.appointmentsApi.create).toHaveBeenCalledWith({ propertyId: 'p1', start: pktToIso(date, '10:00'), durationMinutes: 30 });
    expect(await screen.findByText(/has been sent/)).toBeTruthy();
  });

  it('shows a taken slot on the time field', async () => {
    api.appointmentsApi.create.mockRejectedValue({ code: 'SLOT_TAKEN', message: 'That time is no longer available. Please choose another time.', errors: [] });
    const user = userEvent.setup();
    renderAt(<ViewingModal open onClose={() => {}} property={property} />);
    await pick(user);
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText(/no longer available/)).toBeTruthy();
  });

  it('only offers times that fit the chosen length', async () => {
    const user = userEvent.setup();
    renderAt(<ViewingModal open onClose={() => {}} property={property} />);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: addDays(pktDate(), 3) } });
    const times = () => within(screen.getByLabelText(/Start time/)).getAllByRole('option').map((o) => o.value).filter(Boolean);
    expect(times().at(-1)).toBe('19:30');
    await user.selectOptions(screen.getByLabelText('Length'), '60');
    expect(times().at(-1)).toBe('19:00');
  });
});

describe('dialogs', () => {
  it('keep focus in the field you are typing in (regression: focus used to jump to the close button on every keystroke)', async () => {
    api.reportsApi.create.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<ReportModal open onClose={() => {}} property={property} />); // a fresh onClose on every render is the normal case
    await user.click(screen.getByRole('radio', { name: 'Something else' }));
    const box = screen.getByLabelText('Describe the problem');
    await user.type(box, 'The photos belong to another house');
    expect(box.value).toBe('The photos belong to another house');
    expect(document.activeElement).toBe(box);
  });
  it('closes on Escape and puts focus on the first field when it opens', async () => {
    const onClose = vi.fn(); const user = userEvent.setup();
    renderAt(<ViewingModal open onClose={onClose} property={property} />);
    expect(document.activeElement).toBe(screen.getByLabelText('Date'));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('report listing', () => {
  it('requires a reason, and a description for "something else"', async () => {
    const user = userEvent.setup();
    renderAt(<ReportModal open onClose={() => {}} property={property} />);
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(screen.getByText('Choose a reason')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Something else' }));
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(screen.getByText(/at least 10 characters/)).toBeTruthy();
    expect(api.reportsApi.create).not.toHaveBeenCalled();
  });

  it('submits, thanks the person and closes', async () => {
    api.reportsApi.create.mockResolvedValue({ reported: true });
    const onClose = vi.fn(); const user = userEvent.setup();
    renderAt(<ReportModal open onClose={onClose} property={property} />);
    await user.click(screen.getByRole('radio', { name: 'Fake listing' }));
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(api.reportsApi.create).toHaveBeenCalledWith('p1', { reason: 'fake_listing' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await screen.findByText(/Our team will review/)).toBeTruthy();
  });

  it('says so when the listing was already reported', async () => {
    api.reportsApi.create.mockRejectedValue({ code: 'ALREADY_REPORTED', message: 'You have already reported this listing.' });
    const user = userEvent.setup();
    renderAt(<ReportModal open onClose={() => {}} property={property} />);
    await user.click(screen.getByRole('radio', { name: 'Fake listing' }));
    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText('You have already reported this listing.')).toBeTruthy();
  });
});

describe('inquiry conversation', () => {
  const thread = (over = {}) => ({ inquiry: { id: 'i1', status: 'read', viewerRole: 'recipient', property: { id: 'p1', title: 'Spacious house', slug: 'spacious-house' }, message: 'Is it still available?', phone: '0300 1112223',
    counterpart: { id: 'b1', name: 'Bilal Buyer', email: 'bilal@x.com' }, replies: [{ id: 'r1', message: 'Yes it is.', mine: true, createdAt: new Date().toISOString() }], createdAt: new Date().toISOString(), ...over } });
  const open = () => renderAt(<InquiryThread />, '/dashboard/inquiries/i1', '/dashboard/inquiries/:id');

  it('shows the lister the buyer\'s contact details and the whole conversation', async () => {
    api.inquiriesApi.get.mockResolvedValue(thread());
    open();
    expect(await screen.findByRole('heading', { name: 'Bilal Buyer' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'bilal@x.com' })).toBeTruthy(); expect(screen.getByRole('link', { name: '0300 1112223' })).toBeTruthy();
    expect(screen.getByText('Is it still available?')).toBeTruthy(); expect(screen.getByText('Yes it is.')).toBeTruthy();
  });

  it('does not show the buyer the lister\'s contact details', async () => {
    api.inquiriesApi.get.mockResolvedValue(thread({ viewerRole: 'buyer', counterpart: { id: 'l1', name: 'Lena Lister', role: 'agent' } }));
    open();
    expect(await screen.findByRole('heading', { name: 'Lena Lister' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull();
  });

  it('sends a reply and clears the box', async () => {
    api.inquiriesApi.get.mockResolvedValue(thread());
    api.inquiriesApi.reply.mockResolvedValue(thread({ replies: [{ id: 'r1', message: 'Yes it is.', mine: true, createdAt: new Date().toISOString() }, { id: 'r2', message: 'Come on Friday.', mine: true, createdAt: new Date().toISOString() }] }));
    const user = userEvent.setup();
    open();
    const box = await screen.findByLabelText('Your reply');
    await user.type(box, 'Come on Friday.');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    expect(api.inquiriesApi.reply).toHaveBeenCalledWith('i1', 'Come on Friday.');
    expect(await screen.findByText('Come on Friday.')).toBeTruthy();
    expect(box.value).toBe('');
  });

  it('closing needs confirmation, then replaces the reply box with a notice', async () => {
    api.inquiriesApi.get.mockResolvedValue(thread());
    api.inquiriesApi.setStatus.mockResolvedValue(thread({ status: 'closed' }));
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: 'Close conversation' }));
    expect(api.inquiriesApi.setStatus).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close conversation' }));
    expect(api.inquiriesApi.setStatus).toHaveBeenCalledWith('i1', 'closed');
    expect(await screen.findByText(/This conversation is closed/)).toBeTruthy();
    expect(screen.queryByLabelText('Your reply')).toBeNull();
  });

  it('says plainly when the conversation belongs to someone else', async () => {
    api.inquiriesApi.get.mockRejectedValue({ status: 404, message: 'Inquiry not found' });
    open();
    expect(await screen.findByText('Conversation not found')).toBeTruthy();
  });
});

describe('viewings page', () => {
  const appt = (over = {}) => ({ id: 'a1', status: 'requested', viewerRole: 'host', property: { id: 'p1', title: 'Spacious house', slug: 's' }, start: '2030-01-05T05:00:00.000Z', end: '2030-01-05T05:30:00.000Z',
    message: 'Can I bring my wife?', counterpart: { id: 'q1', name: 'Rana Requester', email: 'rana@x.com', phone: '0300 9998887' }, ...over });
  const list = (items) => ({ appointments: items, meta: { total: items.length, totalPages: 1, page: 1 } });

  it('offers each side only what it may do', () => {
    const now = new Date('2030-01-04T00:00:00Z');
    expect(actionsFor(appt(), now)).toEqual(['confirm', 'reschedule', 'decline']);
    expect(actionsFor(appt({ status: 'confirmed' }), now)).toEqual(['reschedule', 'cancel']);
    expect(actionsFor(appt({ status: 'confirmed' }), new Date('2030-01-06T00:00:00Z'))).toEqual(['complete']);
    expect(actionsFor(appt({ viewerRole: 'requester' }), now)).toEqual(['cancel']);
    expect(actionsFor(appt({ viewerRole: 'requester', status: 'rescheduled' }), now)).toEqual(['accept', 'cancel']);
    expect(actionsFor(appt({ status: 'declined' }), now)).toEqual([]);
    expect(actionsFor(appt({ viewerRole: 'requester', status: 'confirmed' }), now)).toEqual(['cancel']);
  });

  it('shows the time in Pakistan time and the requester\'s contact details to the host', async () => {
    asUser({ role: 'owner' });
    api.appointmentsApi.received.mockResolvedValue(list([appt()]));
    renderAt(<Appointments />, '/dashboard/appointments');
    expect(await screen.findByText(/10:00 am to 10:30 am/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '0300 9998887' })).toBeTruthy();
  });

  it('confirms a request in one click', async () => {
    asUser({ role: 'owner' });
    api.appointmentsApi.received.mockResolvedValue(list([appt()]));
    api.appointmentsApi.act.mockResolvedValue({ appointment: appt({ status: 'confirmed' }) });
    const user = userEvent.setup();
    renderAt(<Appointments />, '/dashboard/appointments');
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(api.appointmentsApi.act).toHaveBeenCalledWith('a1', { action: 'confirm' });
  });

  it('declining asks first and can include a note', async () => {
    asUser({ role: 'owner' });
    api.appointmentsApi.received.mockResolvedValue(list([appt()]));
    api.appointmentsApi.act.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Appointments />, '/dashboard/appointments');
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    expect(api.appointmentsApi.act).not.toHaveBeenCalled();
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Add a note (optional)'), 'Not available that week');
    await user.click(dialog.getByRole('button', { name: 'Decline' }));
    expect(api.appointmentsApi.act).toHaveBeenCalledWith('a1', { action: 'decline', reason: 'Not available that week' });
  });

  it('shows the reason when two requests clash', async () => {
    asUser({ role: 'owner' });
    api.appointmentsApi.received.mockResolvedValue(list([appt()]));
    api.appointmentsApi.act.mockRejectedValue({ code: 'SLOT_TAKEN', message: 'That time is no longer available. Please choose another time.', errors: [] });
    const user = userEvent.setup();
    renderAt(<Appointments />, '/dashboard/appointments');
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText(/no longer available/)).toBeTruthy();
  });

  it('a buyer sees only their own requests, and can accept a proposed time', async () => {
    asUser({ role: 'buyer' });
    api.appointmentsApi.mine.mockResolvedValue(list([appt({ viewerRole: 'requester', status: 'rescheduled', counterpart: { id: 'h1', name: 'Hina Host', role: 'owner' } })]));
    api.appointmentsApi.act.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt(<Appointments />, '/dashboard/appointments');
    expect(screen.queryByRole('tab')).toBeNull(); // no "requests for my listings" tab
    await user.click(await screen.findByRole('button', { name: 'Accept new time' }));
    expect(api.appointmentsApi.act).toHaveBeenCalledWith('a1', { action: 'accept' });
    expect(api.appointmentsApi.received).not.toHaveBeenCalled();
  });
});

describe('profile', () => {
  it('saves the agent profile with clean lists, and clears optional contacts', async () => {
    asUser({ role: 'agent', phone: '', agentProfile: {} });
    api.agentsApi.saveProfile.mockResolvedValue({ user: { id: 'u1', name: 'Sam Buyer', role: 'agent' } });
    const user = userEvent.setup();
    renderAt(<Profile />, '/dashboard/profile');
    await user.type(screen.getByLabelText('About you'), 'Ten years selling homes in Lahore.');
    await user.type(screen.getByLabelText('Areas you cover'), 'DHA, Gulberg,  DHA , ');
    await user.click(screen.getByRole('checkbox', { name: 'House' }));
    await user.click(screen.getByRole('button', { name: 'Save public profile' }));
    await waitFor(() => expect(api.agentsApi.saveProfile).toHaveBeenCalledWith({ agencyName: null, bio: 'Ten years selling homes in Lahore.', serviceAreas: ['DHA', 'Gulberg'], specialties: ['house'], contactPhone: null, contactEmail: null }));
    expect(auth.setUser).toHaveBeenCalled();
  });

  it('asks for a real bio before sending anything, and shows the agent section only to agents', async () => {
    asUser({ role: 'agent', agentProfile: {} });
    const user = userEvent.setup();
    renderAt(<Profile />, '/dashboard/profile');
    await user.type(screen.getByLabelText('About you'), 'short');
    await user.click(screen.getByRole('button', { name: 'Save public profile' }));
    expect(await screen.findByText(/at least 20 characters/)).toBeTruthy();
    expect(api.agentsApi.saveProfile).not.toHaveBeenCalled();
    cleanup(); asUser({ role: 'buyer' });
    renderAt(<Profile />, '/dashboard/profile');
    expect(screen.queryByLabelText('About you')).toBeNull();
  });

  it('keeps the email read-only and saves name and phone', async () => {
    asUser({ role: 'buyer', phone: '' });
    api.usersApi.update.mockResolvedValue({ user: { id: 'u1', name: 'Samira Buyer', role: 'buyer' } });
    const user = userEvent.setup();
    renderAt(<Profile />, '/dashboard/profile');
    expect(screen.getByLabelText('Email').disabled).toBe(true);
    const name = screen.getByLabelText('Full name');
    await user.clear(name); await user.type(name, 'Samira Buyer');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.usersApi.update).toHaveBeenCalledWith({ name: 'Samira Buyer', phone: '' }));
  });
});
