import { useEffect, useState } from 'react';
import { api } from '../api/client';

// Specialties or symptoms from the API (edited in the admin panel), fetched
// once per page load and shared by every component that asks. Returns null
// while loading, then the list ([] if the request failed).
const cache = {};

export function useCatalog(kind) {
  const [items, setItems] = useState(() => cache[kind]?.value ?? null);
  useEffect(() => {
    if (cache[kind]?.value) return undefined;
    let active = true;
    if (!cache[kind]) {
      cache[kind] = {};
      cache[kind].promise = api.get(`/${kind}`)
        .then(list => { cache[kind].value = list; return list; })
        .catch(() => { delete cache[kind]; return []; });
    }
    cache[kind].promise.then(list => { if (active) setItems(list); });
    return () => { active = false; };
  }, [kind]);
  return items;
}

// The name in the UI language, falling back to English.
export const localName = (item, lang) => (lang === 'bn' && item.name_bn) || item.name;
