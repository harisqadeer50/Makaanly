import { describe, it, expect } from 'vitest';
import config from '../tailwind.config.js';

// WCAG 2.x contrast. Normal text needs 4.5:1 (AA). These are the real colour pairs used across the app.
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const { navy, sage, stone } = config.theme.extend.colors;
const white = '#ffffff'; const red = { 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 100: '#fee2e2', 50: '#fef2f2' }; const amber = { 100: '#fef3c7', 50: '#fffbeb', 400: '#fbbf24', 800: '#92400e', 900: '#78350f' };

const PAIRS = [
  ['secondary text on white', stone[500], white], ['secondary text on the page background', stone[500], stone[50]], ['secondary text on light panels', stone[500], stone[100]], ['secondary text on pale navy', stone[500], navy[50]],
  ['body text on white', stone[700], white], ['headings on the page background', navy[900], stone[50]], ['text on light panels', navy[800], stone[100]],
  ['accent button label', white, sage[500]], ['accent button hover', white, sage[600]], ['links', sage[600], white], ['links on the page background', sage[600], stone[50]], ['accent text on white', sage[500], white],
  ['green badge', sage[700], sage[100]], ['green chip', sage[600], sage[100]], ['footer text', navy[300], navy[900]], ['footer links', navy[200], navy[900]], ['hero text', navy[100], navy[900]], ['logo accent on navy', sage[300], navy[900]],
  ['primary button', white, navy[900]], ['primary button hover', white, navy[700]], ['error text', red[700], white], ['error text on the page background', red[700], stone[50]], ['error panel', red[900], red[50]], ['red badge', red[800], red[100]], ['danger button', white, red[700]],
  ['amber badge', amber[800], amber[100]], ['warning panel', amber[900], amber[50]], ['count pill', navy[900], amber[400]],
];
describe('colour contrast (WCAG AA, 4.5:1 for normal text)', () => {
  it.each(PAIRS)('%s', (_name, fg, bg) => { expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5); });
});
