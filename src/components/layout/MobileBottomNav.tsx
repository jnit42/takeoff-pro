/**
 * Mobile Bottom Navigation
 * Handoff-style: Magic button is the STAR, nav is secondary
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { Home, FolderOpen, Settings, MessageSquarePlus } from 'lucide-react';
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

interface MobileBottomNavProps {
  onMagicPress?: () => void;
  showMagicButton?: boolean;
}

export function MobileBottomNav({ onMagicPress, showMagicButton = false }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active item
  const activeId = NAV_ITEMS.find(item => 
    location.pathname.startsWith(item.path)
  )?.id || 'home';

  // Check if we're on a project page
  const isProjectPage = location.pathname.includes('/projects/') && location.pathname.length > '/projects/'.length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto relative">
        {/* Left nav items */}
        <NavButton 
          item={NAV_ITEMS[0]} 
          isActive={NAV_ITEMS[0].id === activeId}
          onClick={() => navigate(NAV_ITEMS[0].path)}
        />
        
        {/* Center: Magic Button (only on project pages) or Library */}
        {isProjectPage || showMagicButton ? (
          <button
            onClick={onMagicPress}
            className="relative -mt-6 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          >
            <MessageSquarePlus className="h-6 w-6" />
            <span className="sr-only">Ask AI</span>
            {/* Pulse animation */}
            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
          </button>
        ) : (
          <NavButton 
            item={NAV_ITEMS[1]} 
            isActive={NAV_ITEMS[1].id === activeId}
            onClick={() => navigate(NAV_ITEMS[1].path)}
          />
        )}
        
        {/* Right nav item */}
        <NavButton 
          item={NAV_ITEMS[2]} 
          isActive={NAV_ITEMS[2].id === activeId}
          onClick={() => navigate(NAV_ITEMS[2].path)}
        />
      </div>
    </nav>
  );
}

function NavButton({ 
  item, 
  isActive, 
  onClick 
}: { 
  item: NavItem; 
  isActive: boolean; 
  onClick: () => void;
}) {
  const Icon = item.icon;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center w-16 h-full gap-0.5 transition-colors',
        isActive 
          ? 'text-primary' 
          : 'text-muted-foreground active:text-foreground'
      )}
    >
      <Icon className={cn(
        'h-5 w-5 transition-transform',
        isActive && 'scale-110'
      )} />
      <span className={cn(
        'text-[10px]',
        isActive && 'font-semibold'
      )}>
        {item.label}
      </span>
    </button>
  );
}
