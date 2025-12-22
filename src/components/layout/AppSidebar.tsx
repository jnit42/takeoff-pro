import { NavLink, useLocation } from 'react-router-dom';
import {
  FolderKanban,
  Settings,
  LogOut,
  HardHat,
  Library,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { getFormattedVersion } from '@/lib/appVersion';

// Simplified navigation - 3 main items
const navItems = [
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const handleNavClick = () => {
    onNavigate?.();
  };

  return (
    <aside className="h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col md:fixed md:left-0 md:top-0 md:z-40 md:h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
          <HardHat className="h-6 w-6 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-semibold text-lg leading-tight">Takeoff</h1>
          <p className="text-xs text-sidebar-foreground/60">+ SubPay</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={handleNavClick}
                  className={cn(
                    'nav-item',
                    isActive && 'nav-item-active'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-sidebar-foreground/60">Estimator</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>

      {/* Version Badge */}
      <div className="border-t border-sidebar-border px-4 py-2">
        <p className="text-[10px] text-sidebar-foreground/40 text-center">
          {getFormattedVersion()}
        </p>
      </div>
    </aside>
  );
}
