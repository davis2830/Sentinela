import type { ButtonHTMLAttributes } from 'react';
import { useAuthStore } from '../../store/authStore';
export default function AdminButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const user = useAuthStore(state => state.user);
  return user?.is_staff || user?.is_superuser ? <button type="button" {...props} /> : null;
}
