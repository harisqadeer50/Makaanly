import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/admin';
import Input from '../common/Input';
import { Select } from '../common/FormFields';

// Lets an administrator choose which owner or agent a new listing belongs to.
export default function OwnerPicker({ value, onChange, error }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState(null);
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'owner-search', term], enabled: term.length >= 2,
    queryFn: () => adminApi.users({ role: 'owner,agent', status: 'active', q: term, limit: 10 }),
  });
  const results = data?.users || [];
  const options = [...(selected && !results.some((u) => u.id === selected.id) ? [selected] : []), ...results]
    .map((u) => ({ value: u.id, label: `${u.name} (${u.email}), ${u.role}` }));

  return (
    <fieldset className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <legend className="px-1 text-sm font-medium text-navy-800">Listing owner</legend>
      <Input label="Find an owner or agent" placeholder="Type a name or email" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      <Select label="Owner or agent" value={value || ''} error={error} disabled={!options.length}
        onChange={(e) => { const u = results.find((r) => r.id === e.target.value) || selected; setSelected(u || null); onChange(e.target.value || ''); }}
        placeholder={term.length < 2 ? 'Search first' : isFetching ? 'Searching…' : options.length ? 'Choose a person' : 'No matching active owner or agent'} options={options} />
    </fieldset>
  );
}
