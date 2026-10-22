import { useEffect, useState } from 'react';

/**
 * Pages live after the # (e.g. #/game/penguin-league), so GitHub Pages only ever
 * serves index.html and every link still works when it's shared or refreshed.
 */
export interface Route {
  parts: string[];
  query: URLSearchParams;
}

function read(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs || '') };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string) {
  const next = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to);
  if (window.location.hash === next) return;
  window.location.hash = next;
}

export const href = (to: string) => '#' + (to.startsWith('/') ? to : '/' + to);
