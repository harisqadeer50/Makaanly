import { APP_TIMEZONE } from '../config/constants.js';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// Wall-clock parts of an instant in Pakistan time.
export function localParts(date) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute };
}
export const minutesOfDay = (date) => { const p = localParts(date); return p.hour * 60 + p.minute; };
export const localDay = (date) => { const p = localParts(date); return `${p.year}-${p.month}-${p.day}`; };

// "2026-10-12" for the calendar day in Pakistan.
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE });
export const localDateKey = (date) => dayKey.format(date);

// "Sat 18 Oct, 10:00 am" in Pakistan time, for emails and notifications.
const human = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
export const formatLocal = (date) => human.format(date).replace(',', '').replace(/(\d{1,2} \w{3}) /, '$1, ').replace(/\s?(am|pm)/i, (m) => ` ${m.trim().toLowerCase()}`);
