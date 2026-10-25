import { useMemo } from 'react';
import Input from '../common/Input';
import { Select } from '../common/FormFields';
import { addDays, bookableTimes, pktDate } from '../../utils/datetime';

// Date, duration and start time for a viewing, in Pakistan time.
export default function SlotPicker({ value, onChange, error, showDuration = true }) {
  const today = pktDate();
  const times = useMemo(() => (value.date ? bookableTimes(value.date, value.duration) : []), [value.date, value.duration]);
  const set = (patch) => {
    const next = { ...value, ...patch };
    if (!bookableTimes(next.date || today, next.duration).includes(next.time)) next.time = '';
    onChange(next);
  };
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-medium text-navy-800">When would you like to visit?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Date" type="date" min={today} max={addDays(today, 60)} value={value.date} onChange={(e) => set({ date: e.target.value })} />
        {showDuration && <Select label="Length" value={value.duration} onChange={(e) => set({ duration: Number(e.target.value) })} options={[{ value: 30, label: '30 minutes' }, { value: 60, label: '1 hour' }]} />}
      </div>
      <Select label="Start time (Pakistan time)" value={value.time} onChange={(e) => set({ time: e.target.value })} disabled={!value.date}
        placeholder={!value.date ? 'Choose a date first' : times.length ? 'Choose a time' : 'No times left on this day'}
        options={times.map((t) => ({ value: t, label: t }))} error={error} hint="Viewings take place between 9:00 and 20:00." />
    </fieldset>
  );
}
