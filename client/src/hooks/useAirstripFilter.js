import { useMemo } from 'react';

export function useAirstripFilter(items = [], query = '') {
  return useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((it) => {
      const p = it.properties || it;
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.state && p.state.toLowerCase().includes(q)) ||
        (p.nearest_airport?.code && p.nearest_airport.code.toLowerCase().includes(q))
      );
    });
  }, [items, query]);
}
