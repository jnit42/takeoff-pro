/**
 * Mobile Bottom Navigation
 * Replaces sidebar on mobile for quick navigation
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Calculator, FolderOpen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: typeof Home;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/projects' },
  { id: 'library', label: 'Library', icon: FolderOpen, path: '/library' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active item
  const activeId = NAV_ITEMS.find(item => 
    location.pathname.startsWith(item.path)
  )?.id || 'home';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeId;
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full gap-1 transition-colors',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn(
                'h-5 w-5 transition-transform',
                isActive && 'scale-110'
              )} />
              <span className={cn(
                'text-[10px] font-medium',
                isActive && 'font-semibold'
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
