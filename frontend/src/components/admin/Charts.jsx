import { cn } from '../../utils/cn';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (d) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

// Every chart has a plain-text summary and a hidden table, so the numbers are available without seeing the graphic.
function Hidden({ caption, headers, rows }) {
  return (
    <table className="sr-only"><caption>{caption}</caption>
      <thead><tr>{headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
  );
}

export function Panel({ title, children, className }) {
  return <section className={cn('rounded-card bg-white p-5 shadow-card', className)} aria-label={title}><h2 className="mb-4 font-sans text-base font-semibold">{title}</h2>{children}</section>;
}

export function BarList({ items, label, emptyText = 'No data yet.' }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (!items.length) return <p className="text-sm text-stone-500">{emptyText}</p>;
  return (
    <div>
      <ul className="space-y-2.5">
        {items.map((i) => (
          <li key={i.name} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm" aria-hidden="true">
            <span className="truncate">{i.name}</span>
            <span className="h-3 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-sage-500" style={{ width: `${(i.count / max) * 100}%` }} /></span>
            <span className="text-right font-medium tabular-nums">{i.count}</span>
          </li>
        ))}
      </ul>
      <Hidden caption={label} headers={['City', 'Listings']} rows={items.map((i) => [i.name, i.count])} />
    </div>
  );
}

const W = 600; const H = 160; const PAD = { l: 30, r: 8, t: 8, b: 22 };
const niceMax = (n) => Math.max(4, Math.ceil(n / 4) * 4);
function Axes({ max, first, last }) {
  return (
    <g className="text-[10px] text-stone-500" fill="currentColor">
      {[0, 0.5, 1].map((f) => { const y = PAD.t + (H - PAD.t - PAD.b) * (1 - f); return <g key={f}><line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#e1e5e9" /><text x={PAD.l - 4} y={y + 3} textAnchor="end">{Math.round(max * f)}</text></g>; })}
      <text x={PAD.l} y={H - 6}>{shortDate(first)}</text><text x={W - PAD.r} y={H - 6} textAnchor="end">{shortDate(last)}</text>
    </g>
  );
}

export function LineChart({ data, label, unit = 'per day' }) {
  const max = niceMax(Math.max(...data.map((d) => d.count)));
  const x = (i) => PAD.l + ((W - PAD.l - PAD.r) * i) / Math.max(1, data.length - 1);
  const y = (v) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const total = data.reduce((n, d) => n + d.count, 0);
  const points = data.map((d, i) => `${x(i)},${y(d.count)}`).join(' ');
  return (
    <div>
      <p className="mb-2 text-sm text-stone-500">{total} in the last {data.length} days</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={`${label}: ${total} in the last ${data.length} days`}>
        <Axes max={max} first={data[0].date} last={data.at(-1).date} />
        <polyline points={points} fill="none" stroke="#3b674f" strokeWidth="2" strokeLinejoin="round" />
        {data.map((d, i) => d.count > 0 && <circle key={d.date} cx={x(i)} cy={y(d.count)} r="2.5" fill="#3b674f"><title>{`${shortDate(d.date)}: ${d.count}`}</title></circle>)}
      </svg>
      <Hidden caption={`${label} (${unit})`} headers={['Date', 'Count']} rows={data.map((d) => [d.date, d.count])} />
    </div>
  );
}

export function StackedBars({ data, series, label }) {
  const max = niceMax(Math.max(...data.map((d) => series.reduce((n, s) => n + d[s.key], 0))));
  const bw = (W - PAD.l - PAD.r) / data.length;
  const y = (v) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const totals = series.map((s) => ({ ...s, total: data.reduce((n, d) => n + d[s.key], 0) }));
  return (
    <div>
      <p className="mb-2 flex flex-wrap gap-4 text-sm text-stone-500">{totals.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />{s.total} {s.label.toLowerCase()}</span>)}<span>in the last {data.length} days</span></p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={`${label}: ${totals.map((s) => `${s.total} ${s.label.toLowerCase()}`).join(', ')}`}>
        <Axes max={max} first={data[0].date} last={data.at(-1).date} />
        {data.map((d, i) => {
          let base = 0;
          return series.map((s) => { const top = base + d[s.key]; const rect = d[s.key] > 0 && <rect key={`${d.date}-${s.key}`} x={PAD.l + i * bw + 1} width={Math.max(1, bw - 2)} y={y(top)} height={y(base) - y(top)} fill={s.color}><title>{`${shortDate(d.date)}: ${d[s.key]} ${s.label.toLowerCase()}`}</title></rect>; base = top; return rect; });
        })}
      </svg>
      <Hidden caption={label} headers={['Date', ...series.map((s) => s.label)]} rows={data.map((d) => [d.date, ...series.map((s) => d[s.key])])} />
    </div>
  );
}
