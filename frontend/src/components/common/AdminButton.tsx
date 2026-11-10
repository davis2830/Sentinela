import type { ButtonHTMLAttributes } from 'react';
import { hasCapability, type Capability } from '../../hooks/useCapability';
import { useAuthStore } from '../../store/authStore';
export default function AdminButton({ capability, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { capability?: Capability }) {
  const user = useAuthStore(state => state.user);
  return (capability ? hasCapability(user, capability) : user?.is_staff || user?.is_superuser) ? <button type="button" {...props} /> : null;
}
