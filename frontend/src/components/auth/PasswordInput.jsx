import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input from '../common/Input';

const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} className="[&_input]:pr-11" {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
        className="absolute right-1 top-[1.85rem] grid h-9 w-9 place-items-center rounded-md text-stone-500 hover:text-navy-900">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
export default PasswordInput;
