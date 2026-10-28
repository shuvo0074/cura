import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

// A crisp, scalable QR code as one SVG path (prints sharp at any size).
export default function QrCode({ value, className = '', title }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
    return { size: n, path: d };
  }, [value]);
  const pad = 2;
  return (
    <svg viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`} className={className}
      role="img" aria-label={title} shapeRendering="crispEdges">
      <rect x={-pad} y={-pad} width={size + pad * 2} height={size + pad * 2} fill="#fff" />
      <path d={path} fill="currentColor" />
    </svg>
  );
}
