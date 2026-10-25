import { useSeo } from './useSeo';

// Sets the page title and keeps the other page tags tidy. Use useSeo directly for pages that need more.
export function usePageTitle(title) { useSeo({ title }); }
