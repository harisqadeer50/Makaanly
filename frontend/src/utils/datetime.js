// Viewings are stored in UTC and always shown in Pakistan time (UTC+5, no daylight saving), whatever the device's own time zone.
const TZ = 'Asia/Karachi';
const OPEN = 9; const CLOSE = 20;

export const pktDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD
export const addDays = (isoDate, n) => { const [y, m, d] = isoDate.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const pktToIso = (date, time) => new Date(`${date}T${time}:00+05:00`).toISOString();

// Start times offered for a viewing of the given length, every 30 minutes inside viewing hours.
export function slotTimes(durationMinutes = 30) {
  const out = [];
  for (let m = OPEN * 60; m + durationMinutes <= CLOSE * 60; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return out;
}
// Hides times that are too soon (the server needs an hour's notice).
export const bookableTimes = (date, durationMinutes, now = new Date(), leadMinutes = 60) =>
  slotTimes(durationMinutes).filter((t) => new Date(pktToIso(date, t)).getTime() >= now.getTime() + leadMinutes * 60000);

const time = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
const day = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
export const formatTime = (iso) => time.format(new Date(iso)).toLowerCase();
export const formatDay = (iso) => day.format(new Date(iso));
export const formatRange = (start, end) => `${formatDay(start)}, ${formatTime(start)} to ${formatTime(end)}`;

export function timeAgo(iso, now = new Date()) {
  const s = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const steps = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, secs] of steps) if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit);
  return 'just now';
}
