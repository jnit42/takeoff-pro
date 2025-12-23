/**
 * Mobile Bottom Navigation
 * Clean, polished navigation with floating AI button
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { Home, FolderOpen, Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: typeof Home;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Projects', icon: Home, path: '/projects' },
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
  const showAIButton = isProjectPage || showMagicButton;

  return (
    <>
      {/* Floating AI Button */}
      {showAIButton && (
        <button
          onClick={onMagicPress}
          className={cn(
            "fixed z-50 flex items-center justify-center",
            "w-14 h-14 rounded-2xl",
            "bg-primary text-primary-foreground",
            "shadow-lg shadow-primary/25",
            "active:scale-95 transition-transform duration-150",
            "bottom-20 right-4"
          )}
        >
          <Sparkles className="h-6 w-6" />
          <span className="sr-only">AI Estimator</span>
        </button>
      )}
      
      {/* Bottom Navigation Bar */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "bg-card/95 backdrop-blur-xl",
        "border-t border-border/50",
        "safe-area-inset-bottom"
      )}>
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {NAV_ITEMS.map((item) => (
            <NavButton 
              key={item.id}
              item={item} 
              isActive={item.id === activeId}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
      </nav>
    </>
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
        'flex flex-col items-center justify-center gap-1 w-20 h-full transition-colors',
        isActive 
          ? 'text-primary' 
          : 'text-muted-foreground active:text-foreground'
      )}
    >
      <div className={cn(
        "p-1.5 rounded-lg transition-colors",
        isActive && "bg-primary/10"
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <span className={cn(
        'text-[11px] font-medium',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}>
        {item.label}
      </span>
    </button>
  );
}