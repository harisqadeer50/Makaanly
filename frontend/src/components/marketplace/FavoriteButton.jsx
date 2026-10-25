import { Heart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFavoriteIds, useToggleFavorite } from '../../hooks/useFavorites';
import { useToast } from '../common/Toast';
import { errorMessage } from '../../utils/applyServerErrors';
import { cn } from '../../utils/cn';

// A separate button that sits above the card's stretched link, so clicking the heart never opens the listing.
export default function FavoriteButton({ propertyId, title, className, label = false }) {
  const { isAuthenticated } = useAuth();
  const { data: ids = [] } = useFavoriteIds();
  const toggle = useToggleFavorite();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const saved = ids.includes(propertyId);

  const onClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!isAuthenticated) { toast.error('Log in to save properties.'); navigate('/login', { state: { from: location } }); return; }
    toggle.mutate({ propertyId, save: !saved }, { onError: (err) => toast.error(errorMessage(err)) });
  };

  return (
    <button type="button" onClick={onClick} aria-pressed={saved} aria-label={saved ? `Remove ${title} from saved properties` : `Save ${title}`}
      className={cn('relative z-10 inline-flex items-center justify-center gap-2 rounded-full bg-white/95 text-navy-900 shadow transition-colors hover:bg-white', label ? 'h-10 px-4 text-sm font-medium' : 'h-9 w-9', className)}>
      <Heart className={cn('h-5 w-5', saved && 'fill-red-600 text-red-600')} aria-hidden="true" />
      {label && (saved ? 'Saved' : 'Save')}
    </button>
  );
}
