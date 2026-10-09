import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
export default function PlaceShareButton({ place, overlay = false }) {
 const { t } = useTranslation();
 const [copied, setCopied] = useState(false);
 const [fallback, setFallback] = useState('');
 async function share(event) {
  event.stopPropagation();
  const url = `${window.location.origin}/${place.type === 'diagnostic' ? 'diagnostic-centres' : 'hospitals'}/${place.id}`;
  if (navigator.share) {
   try { await navigator.share({ title: place.name, text: [place.name, place.address, place.hotline].filter(Boolean).join('\n'), url }); return; }
   catch (error) { if (error.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); setCopied(true); }
  catch { setFallback(url); }
 }
 return <div className={overlay ? "absolute right-3 top-3 z-10 max-w-[calc(100%-24px)]" : "min-w-0"}>
  <button type="button" aria-label={t(copied ? 'link_copied' : 'share')} title={t(copied ? 'link_copied' : 'share')} onClick={share} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/95 shadow-sm text-primary hover:bg-white focus-visible:ring-2 focus-visible:ring-primary"><Share2 size={16} aria-hidden="true" /></button>
  {copied && <span className="sr-only" role="status">{t('link_copied')}</span>}
  {fallback && <input readOnly value={fallback} aria-label={t('share')} onClick={e => { e.stopPropagation(); e.currentTarget.select(); }} className="mt-2 w-full rounded border p-2 text-xs" />}
 </div>;
}
