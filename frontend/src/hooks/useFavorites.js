import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { favoritesApi } from '../services/marketplace';

const KEY = ['favorites', 'ids'];

export function useFavoriteIds() {
  const { isAuthenticated } = useAuth();
  return useQuery({ queryKey: KEY, queryFn: favoritesApi.ids, enabled: isAuthenticated, staleTime: 60000 });
}

// Saves or removes a favorite. The heart changes at once, and rolls back if the server says no.
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, save }) => (save ? favoritesApi.add(propertyId) : favoritesApi.remove(propertyId)),
    onMutate: async ({ propertyId, save }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData(KEY);
      qc.setQueryData(KEY, (ids = []) => (save ? [...new Set([...ids, propertyId])] : ids.filter((id) => id !== propertyId)));
      return { previous };
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(KEY, ctx?.previous),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['favorites'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });
}
