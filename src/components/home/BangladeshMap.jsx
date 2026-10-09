import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, LocateFixed, MapPin, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useFilter } from '../../context/FilterContext';
import { EMPTY_FILTERS } from '../../utils/doctorFilters';
import { distanceKm } from '../../utils/distance';
import HomeSection from './HomeSection';
import { formatNumber } from './landingData';
import { useSiteContent } from '../../context/SiteContentContext';

// Brand-navy scale for doctor density; districts with no doctors stay pale.
const SHADES = ['#d6e0f0', '#adc2e2', '#7f9ccc', '#4a71b0', '#1c4a92'];
const EMPTY_SHADE = '#eef2f8';
const HOVER = '#006CE4';   // Cura action blue: distinct from every navy shade
const INK = '#003580';
const SELECTED = '#FFB700';
const NEAREST_COUNT = 3;

const mercDeg = lat => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

// "M1,2L3,4Z..." → [[[1,2],[3,4]], ...] for point-in-polygon tests.
function pathRings(d) {
  return d.split('M').filter(Boolean).map(r => r.replace('Z', '').split('L').map(p => p.split(',').map(Number)));
}
function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Flat map of Bangladesh's 64 districts in Cura navy, shaded by how many
// doctors each district has. Tap a district to see it and open its doctors;
// "Hospitals near me" marks your location and lists the closest hospitals.
// Boundary data (~28 KB gzipped) and the hospital list load only when the
// section is about to scroll into view.
export default function BangladeshMap({ counts }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setFilterParams } = useFilter();
  const sectionRef = useRef(null);
  const boxRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [geo, setGeo] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [me, setMe] = useState(null);
  const [nearest, setNearest] = useState(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');
  const lang = i18n.language;
  const nameOf = d => (lang === 'bn' ? d.bn : d.name);
  const num = n => formatNumber(n, lang);
  const { home } = useSiteContent();
  const divisionName = name => (lang === 'bn' ? home?.divisions.find(d => d.name === name)?.bn ?? name : name);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    import('../../data/bdDistricts.json').then(m => setGeo(m.default));
    api.get('/hospitals').then(list => setHospitals(list.filter(h => h.lat != null && h.lng != null))).catch(() => {});
  }, [visible]);

  const project = useMemo(() => {
    if (!geo) return null;
    const { x0, y0, scale } = geo.projection;
    return (lat, lng) => [(lng - x0) * scale, (y0 - mercDeg(lat)) * scale];
  }, [geo]);

  // Shade by share of the best-served district, so a district with half as
  // many doctors looks half as deep (a min–max stretch would turn 7 vs 8
  // doctors into palest vs darkest).
  const shadeFor = useMemo(() => {
    const max = Math.max(1, ...Object.values(counts || {}));
    return n => (n ? SHADES[Math.max(0, Math.ceil((n / max) * SHADES.length) - 1)] : EMPTY_SHADE);
  }, [counts]);

  const byName = useMemo(() => Object.fromEntries((geo?.districts || []).map(d => [d.name, d])), [geo]);
  const sel = selected && byName[selected];
  const selHospitals = sel ? hospitals.filter(h => h.location === sel.name) : [];

  function openDoctors(d) {
    setFilterParams({ ...EMPTY_FILTERS, division: [d.division], city: [d.name] });
    navigate('/doctors');
  }

  function trackHover(e, d) {
    const box = boxRef.current.getBoundingClientRect();
    // Keep the tooltip (centred on x, ~180px wide at most) inside the map box.
    const x = Math.min(Math.max(e.clientX - box.left, 90), box.width - 90);
    setHover({ name: d.name, x, y: e.clientY - box.top });
  }

  function locate() {
    if (!navigator.geolocation) { setNotice(t('home_map_unavailable')); return; }
    setLocating(true);
    setNotice('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const pos = { lat: coords.latitude, lng: coords.longitude };
        const xy = project(pos.lat, pos.lng);
        setMe({ ...pos, xy });
        const home = geo.districts.find(d => pathRings(d.d).some(r => insideRing(xy, r)));
        if (home) setSelected(home.name); else setNotice(t('home_map_outside'));
        setNearest(hospitals.map(h => ({ ...h, km: distanceKm(pos, h) })).sort((a, b) => a.km - b.km).slice(0, NEAREST_COUNT));
      },
      err => {
        setLocating(false);
        setNotice(t(err.code === err.PERMISSION_DENIED ? 'home_map_denied' : 'home_map_unavailable'));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  const hoverDistrict = hover && byName[hover.name];

  return (
    <div ref={sectionRef}>
      <HomeSection title={t('home_map_title')} linkTo="/hospitals" linkLabel={t('home_all_hospitals')}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm text-gray-600">{t('home_map_hint')}</p>
              <button type="button" onClick={locate} disabled={!geo || locating}
                className="flex-shrink-0 flex items-center gap-2 h-10 px-3.5 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                <LocateFixed size={16} /> {locating ? t('home_map_locating') : t('home_map_near_me')}
              </button>
            </div>

            <div ref={boxRef} className="relative mx-auto w-full max-w-[420px] lg:max-w-[440px]">
              {geo ? (
                <svg viewBox={geo.viewBox} className="w-full h-auto" role="group" aria-label={t('home_map_title')}>
                  {geo.districts.map(d => {
                    const n = counts?.[d.name] ?? 0;
                    const isSel = d.name === selected;
                    const isHover = hover?.name === d.name;
                    return (
                      <path
                        key={d.name}
                        d={d.d}
                        fillRule="evenodd"
                        fill={isSel ? SELECTED : isHover ? HOVER : shadeFor(n)}
                        stroke="#fff"
                        strokeWidth={isSel ? 2 : 0.8}
                        strokeLinejoin="round"
                        className="cursor-pointer outline-none transition-[fill] duration-150 focus-visible:[stroke:#003580] focus-visible:[stroke-width:2.5]"
                        tabIndex={0}
                        role="button"
                        aria-pressed={isSel}
                        aria-label={`${nameOf(d)}, ${t('n_doctors', { count: n })}`}
                        onClick={() => setSelected(isSel ? null : d.name)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(isSel ? null : d.name); } }}
                        onMouseMove={e => trackHover(e, d)}
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  })}
                  {/* Nearest hospitals and the visitor, once located. */}
                  {nearest && project && nearest.map(h => {
                    const [x, y] = project(h.lat, h.lng);
                    return <circle key={h.id} cx={x} cy={y} r="6" fill="#fff" stroke={INK} strokeWidth="2.5" pointerEvents="none" />;
                  })}
                  {me && (
                    <g pointerEvents="none">
                      <circle cx={me.xy[0]} cy={me.xy[1]} r="14" fill={SELECTED} opacity="0.35" />
                      <circle cx={me.xy[0]} cy={me.xy[1]} r="7" fill={SELECTED} stroke={INK} strokeWidth="2.5" />
                    </g>
                  )}
                </svg>
              ) : (
                <div className="aspect-[600/848] flex items-center justify-center text-sm text-gray-500">{t('loading')}</div>
              )}

              {hoverDistrict && hover && (
                <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap"
                  style={{ left: hover.x, top: hover.y - 10 }}>
                  <span className="font-semibold">{nameOf(hoverDistrict)}</span> · {t('n_doctors', { count: counts?.[hoverDistrict.name] ?? 0 })}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500" aria-hidden="true">
              <span>{t('home_map_fewer')}</span>
              {SHADES.map(c => <span key={c} className="w-6 h-2.5 rounded-sm" style={{ background: c }} />)}
              <span>{t('home_map_more')}</span>
            </div>
            <p className="mt-2 text-xs leading-snug text-gray-400">{t('home_map_attribution')}</p>
          </div>

          {/* Side panel (below the map on phones): selected district, nearest hospitals. */}
          <div className="flex flex-col gap-4">
            {notice && <p role="alert" className="text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{notice}</p>}

            {sel ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('division_label', { name: divisionName(sel.division) })}</p>
                    <h3 className="text-xl font-bold text-gray-900">{nameOf(sel)}</h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {t('n_doctors', { count: counts?.[sel.name] ?? 0 })} · {t('home_map_n_hospitals', { count: selHospitals.length })}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} aria-label={t('close')} className="text-gray-400 p-2 -m-2 rounded-full hover:bg-gray-100">
                    <X size={18} />
                  </button>
                </div>
                {selHospitals.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {selHospitals.slice(0, 4).map(h => (
                      <li key={h.id}>
                        <button type="button" onClick={() => navigate(`/hospitals/${h.id}`)} className="flex items-center gap-2 text-sm text-gray-800 hover:text-primary text-left">
                          <Building2 size={15} className="text-primary flex-shrink-0" /> {h.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" onClick={() => openDoctors(sel)} disabled={!counts?.[sel.name]}
                  className="mt-4 w-full h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:bg-gray-200 disabled:text-gray-500">
                  {t('home_map_see_doctors', { name: nameOf(sel) })}
                </button>
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-gray-500">
                <MapPin size={28} className="text-primary/60" />
                <p className="mt-2 text-sm">{t('home_map_pick')}</p>
              </div>
            )}

            {nearest && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('home_map_nearest')}</h3>
                <ul className="flex flex-col gap-2">
                  {nearest.map(h => (
                    <li key={h.id}>
                      <button type="button" onClick={() => navigate(`/hospitals/${h.id}`)}
                        className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3 hover:border-primary/40">
                        <MapPin size={18} className="text-primary flex-shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-sm text-gray-900 truncate">{h.name}</span>
                          <span className="block text-xs text-gray-500 truncate">{byName[h.location] ? nameOf(byName[h.location]) : h.location}</span>
                        </span>
                        <span className="flex-shrink-0 text-xs font-semibold text-primary">{t('home_map_km', { km: num(Math.round(h.km * 10) / 10) })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </HomeSection>
    </div>
  );
}
