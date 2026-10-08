import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, MessageCircle, Send, Link2, Check, Share2 } from 'lucide-react';

import { buildShareUrl, logShare, copyShareLink, nativeShare } from '../../utils/share';

const POPOVER_WIDTH = 590;

export default function SharePopover({ doctor, anchorEl, onClose }) {
  const popRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleClick(e) {
      if (popRef.current && !popRef.current.contains(e.target) && !anchorEl?.contains(e.target)) {
        onClose();
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, anchorEl]);

  const url = buildShareUrl(doctor);
  const text = `${doctor.name} — ${doctor.specialty} on Cura`;

  function openAndLog(shareUrl) {
    logShare(doctor);
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
    onClose();
  }

  // Instagram and TikTok have no public "share this URL" web intent, so the
  // practical equivalent is: copy the link, then open the app/site to paste it.
  async function copyThenOpen(targetUrl) {
    await copyShareLink(doctor);
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    onClose();
  }

  async function handleCopy() {
    const ok = await copyShareLink(doctor);
    if (ok) {
      setCopied(true);
      setTimeout(onClose, 1000);
    } else {
      onClose();
    }
  }

  async function handleNativeShare() {
    const ok = await nativeShare(doctor);
    if (ok) onClose();
  }

  const channels = [
    // Row 1
    {
      key: 'facebook',
      label: 'Facebook',
      bg: 'bg-[#1877F2]',
      glyph: 'f',
      action: () => openAndLog(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`),
    },
    {
      key: 'messenger',
      label: 'Messenger',
      bg: 'bg-[#0084FF]',
      icon: Send,
      // Messenger has no public web share intent without a registered app id,
      // so this is the same best-effort pattern as Instagram below.
      action: () => copyThenOpen(`fb-messenger://share?link=${encodeURIComponent(url)}`),
    },
    {
      key: 'instagram',
      label: 'Instagram',
      bg: 'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]',
      glyph: 'IG',
      action: () => copyThenOpen('https://www.instagram.com/'),
    },
    {
      key: 'email',
      label: 'Email',
      bg: 'bg-gray-500',
      icon: Mail,
      action: () => openAndLog(`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`),
    },
    // Row 2
    {
      key: 'linkedin',
      label: 'LinkedIn',
      bg: 'bg-[#0A66C2]',
      glyph: 'in',
      action: () => openAndLog(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`),
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      bg: 'bg-[#25D366]',
      icon: MessageCircle,
      action: () => openAndLog(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`),
    },
    {
      key: 'x',
      label: 'X',
      bg: 'bg-black',
      glyph: 'X',
      // Directly under Instagram.
      action: () => openAndLog(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`),
    },
    {
      key: 'copy',
      label: copied ? 'Copied!' : 'Copy Link',
      bg: copied ? 'bg-primary' : 'bg-gray-700',
      icon: copied ? Check : Link2,
      // Directly under Email.
      action: handleCopy,
    },
  ];

  return createPortal(
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 glass-scrim"
        aria-hidden="true"
      />
      <div
        ref={popRef}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: POPOVER_WIDTH,
          maxWidth: 'calc(100vw - 32px)',
        }}
        className="z-50 glass-panel rounded-3xl p-6"
      >
        <p className="text-base font-semibold text-gray-800 mb-5">Share to</p>
        <div className="grid grid-cols-4 gap-5">
          {channels.map(({ key, label, bg, icon: Icon, glyph, action }) => (
            <button key={key} onClick={action}
              className="flex flex-col items-center gap-2 text-xs text-gray-600">
              <span className={`w-14 h-14 rounded-full flex items-center justify-center text-white flex-shrink-0 ${bg}`}>
                {Icon ? <Icon size={24} /> : <span className="font-bold text-lg">{glyph}</span>}
              </span>
              {label}
            </button>
          ))}
        </div>

        {typeof navigator !== 'undefined' && navigator.share && (
          <button onClick={handleNativeShare}
            className="mt-5 w-full flex items-center justify-center gap-1.5 text-sm text-primary font-medium border-t border-gray-100 pt-4">
            <Share2 size={15} /> More options
          </button>
        )}
      </div>
    </>,
    document.body
  );
}
