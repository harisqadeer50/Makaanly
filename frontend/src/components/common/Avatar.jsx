import { cn } from '../../utils/cn';
import { cloudinaryUrl } from '../../utils/images';

export default function Avatar({ name = '?', url, size = 'h-10 w-10', className }) {
  return url
    ? <img src={cloudinaryUrl(url, { w: 160, h: 160 })} alt="" className={cn('shrink-0 rounded-full object-cover', size, className)} />
    : <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-full bg-navy-900 font-semibold text-white', size, className)}>{name.trim()[0]?.toUpperCase() || '?'}</span>;
}
