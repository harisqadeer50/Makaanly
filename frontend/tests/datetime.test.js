import { describe, it, expect } from 'vitest';
import { pktDate, addDays, pktToIso, slotTimes, bookableTimes, formatTime, formatDay, formatRange, timeAgo } from '../src/utils/datetime';

describe('Pakistan time helpers', () => {
  it('converts a Pakistan wall-clock time to UTC (UTC+5, no daylight saving)', () => {
    expect(pktToIso('2026-10-12', '10:00')).toBe('2026-10-12T05:00:00.000Z');
    expect(pktToIso('2026-07-01', '09:30')).toBe('2026-07-01T04:30:00.000Z'); // same offset in summer
    expect(pktToIso('2026-10-12', '19:30')).toBe('2026-10-12T14:30:00.000Z');
  });
  it('knows the calendar day in Pakistan, even when it differs from UTC', () => {
    expect(pktDate(new Date('2026-10-11T20:30:00Z'))).toBe('2026-10-12'); // already tomorrow in Pakistan
    expect(pktDate(new Date('2026-10-11T18:59:00Z'))).toBe('2026-10-11');
  });
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('offers 30-minute starts inside viewing hours, shorter for longer viewings', () => {
    const t30 = slotTimes(30); const t60 = slotTimes(60);
    expect([t30[0], t30.at(-1), t30.length]).toEqual(['09:00', '19:30', 22]);
    expect([t60[0], t60.at(-1), t60.length]).toEqual(['09:00', '19:00', 21]);
  });
  it('hides times without an hour of notice', () => {
    const now = new Date('2026-10-12T06:10:00Z'); // 11:10 in Pakistan
    expect(bookableTimes('2026-10-12', 30, now)[0]).toBe('12:30');
    expect(bookableTimes('2026-10-13', 30, now)).toHaveLength(22);
    expect(bookableTimes('2026-10-11', 30, now)).toEqual([]);
  });
  it('formats in Pakistan time whatever the device time zone is', () => {
    expect(formatTime('2026-10-12T05:00:00Z')).toBe('10:00 am');
    expect(formatTime('2026-10-12T14:30:00Z')).toBe('7:30 pm');
    expect(formatDay('2026-10-11T20:30:00Z')).toMatch(/Mon.*12 Oct/); // Monday in Pakistan
    expect(formatRange('2026-10-12T05:00:00Z', '2026-10-12T05:30:00Z')).toMatch(/10:00 am to 10:30 am$/);
  });
  it('describes how long ago something happened', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    expect(timeAgo('2026-10-12T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-10-12T11:55:00Z', now)).toBe('5 minutes ago');
    expect(timeAgo('2026-10-12T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-10-11T12:00:00Z', now)).toBe('yesterday');
  });
});
