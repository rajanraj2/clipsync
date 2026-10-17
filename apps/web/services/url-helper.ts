'use client';

export function getBasePath(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) {
    return process.env.NEXT_PUBLIC_BASE_PATH;
  }
  if (typeof window !== 'undefined') {
    // If hosted on GitHub Pages sub-path (e.g. /clipsync/)
    if (window.location.pathname.startsWith('/clipsync')) {
      return '/clipsync';
    }
  }
  return '';
}

export function toAppUrl(path: string): string {
  const base = getBasePath();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
