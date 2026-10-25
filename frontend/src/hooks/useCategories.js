import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '../services/admin';
import { PROPERTY_TYPES } from '../utils/propertyOptions';

// The property types currently offered, in the order admins chose. While loading (or if the request fails) every type is offered,
// so a hiccup never empties a form. `keep` lets an edit form keep showing a listing's current type even if it was hidden since.
export function useActiveTypes(keep) {
  const { data } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list, staleTime: 60000 });
  if (!data) return PROPERTY_TYPES;
  const order = new Map(data.map((c, i) => [c.key, i]));
  return PROPERTY_TYPES.filter((t) => order.has(t.value) || t.value === keep).sort((a, b) => (order.get(a.value) ?? 99) - (order.get(b.value) ?? 99));
}
