import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
