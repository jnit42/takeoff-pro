/**
 * App Version and Build Information
 * Updated at build time via Vite define plugin
 */

export const APP_VERSION = '1.0.0';
export const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIME || new Date().toISOString();

export function getFormattedVersion(): string {
  const buildDate = new Date(BUILD_TIMESTAMP);
  const formattedDate = buildDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const formattedTime = buildDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  return `v${APP_VERSION} • built ${formattedDate} ${formattedTime}`;
}
