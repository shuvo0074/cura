import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { applyTextEdits } from '../i18n/index.js';

// What admins edit on the Home page, Site text and Photo credits tabs,
// loaded once per page load. Phone numbers have built-in values so the
// emergency number always shows, even before (or without) the request.
const DEFAULT_CONTACTS = { emergency: '999', health_line: '16263', hotline: '16966' };
const SiteContentContext = createContext({ contacts: DEFAULT_CONTACTS, home: null, credits: null, text: null, refresh: () => {} });

export function SiteContentProvider({ children }) {
  const [content, setContent] = useState({});
  const apply = useCallback(next => {
    applyTextEdits(next.text);
    setContent(next);
  }, []);
  const refresh = useCallback(() => api.get('/site-content').then(apply).catch(() => {}), [apply]);
  useEffect(() => { refresh(); }, [refresh]);
  const value = { ...content, contacts: { ...DEFAULT_CONTACTS, ...content.contacts }, apply, refresh };
  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

export const useSiteContent = () => useContext(SiteContentContext);
