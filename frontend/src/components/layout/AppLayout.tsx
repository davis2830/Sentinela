import { ReactNode, useEffect, useRef, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../store/authStore';
import ModuleLoadingSkeleton from '../common/ModuleLoadingSkeleton';

interface AppLayoutProps {
  children?: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Fetch current user once on initial mount of the layout, not on every page transition
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Scroll to top of content area on navigation
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  return (
    <div className="fixed inset-0 bg-bg-dark flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar />
        <main ref={mainRef} className="flex-1 min-w-0 p-6 sm:p-8 overflow-y-auto h-full">
          <Suspense fallback={<ModuleLoadingSkeleton />}>
            {children || <Outlet />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}