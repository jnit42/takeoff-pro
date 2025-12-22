import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * Mobile-optimized tabs with horizontal scrolling
 * Use these for navigation tabs that need to scroll on small screens
 */

const MobileTabs = TabsPrimitive.Root;

const MobileTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none",
        "-mx-4 px-4 sm:mx-0 sm:px-0",
        "snap-x snap-mandatory",
        className,
      )}
      {...props}
    />
    {/* Fade gradient on right edge to indicate more content */}
    <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
  </div>
));
MobileTabsList.displayName = "MobileTabsList";

const MobileTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Base styles
      "inline-flex items-center justify-center whitespace-nowrap",
      "rounded-full px-3 py-1.5",
      "text-sm font-medium",
      "ring-offset-background transition-all",
      "snap-start flex-shrink-0",
      // Default state
      "bg-muted/60 text-muted-foreground",
      "border border-transparent",
      // Active state
      "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
      "data-[state=active]:shadow-sm",
      // Focus state
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      // Disabled state
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
MobileTabsTrigger.displayName = "MobileTabsTrigger";

const MobileTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
MobileTabsContent.displayName = "MobileTabsContent";

export { MobileTabs, MobileTabsList, MobileTabsTrigger, MobileTabsContent };
