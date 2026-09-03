import { ReactNode } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-bg-dark flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 p-6 sm:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}