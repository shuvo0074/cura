import styles from './login.module.css';

/**
 * "Doctor as a hero" illustration for the welcome screen (spec 1.3).
 *
 * Drawn inline rather than shipped as an image so every fill resolves to a
 * theme token through `login.module.css` — the artwork follows light/dark and
 * a rebrand like the rest of the UI. Purely decorative, hence `aria-hidden`.
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 420 420"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {/* Backdrop */}
      <circle className={styles.artDisc} cx="210" cy="212" r="176" />
      <ellipse className={styles.artShadow} cx="210" cy="382" rx="104" ry="11" />

      {/* Pulse line running behind the figure */}
      <path
        className={styles.artPulse}
        d="M44 236 H128 L140 212 L154 262 L168 196 L180 236 H252 L262 220 L272 248 L282 236 H376"
      />

      {/* Cape, caught by the wind */}
      <path
        className={styles.artCape}
        d="M170 150 C132 214 108 300 112 374 Q156 356 196 376 Q244 352 294 374 Q326 360 344 368 C320 296 296 214 250 150 Z"
      />

      {/* Legs and shoes */}
      <rect className={styles.artTrousers} x="186" y="296" width="18" height="76" rx="6" />
      <rect className={styles.artTrousers} x="216" y="296" width="18" height="76" rx="6" />
      <ellipse className={styles.artShoe} cx="192" cy="374" rx="16" ry="7" />
      <ellipse className={styles.artShoe} cx="228" cy="374" rx="16" ry="7" />

      {/* Left arm resting on the hip */}
      <path className={styles.artSleeveOutline} d="M174 160 L142 222 L168 262" />
      <path className={styles.artSleeve} d="M174 160 L142 222 L168 262" />
      <circle className={styles.artSkin} cx="170" cy="264" r="9" />

      {/* White coat */}
      <path className={styles.artCoat} d="M170 148 Q210 136 250 148 L264 312 Q210 324 156 312 Z" />
      <path className={styles.artScrubs} d="M194 148 L210 184 L226 148 Z" />
      <path className={styles.artLine} d="M194 148 L204 218 M226 148 L216 218 M210 228 V312" />

      {/* Chest emblem: shield and medical cross */}
      <path
        className={styles.artShield}
        d="M192 236 H228 V252 C228 266 219 274 210 278 C201 274 192 266 192 252 Z"
      />
      <rect className={styles.artCross} x="207" y="242" width="6" height="26" rx="1.5" />
      <rect className={styles.artCross} x="197" y="252" width="26" height="6" rx="1.5" />

      {/* Right arm raised — the hero pose */}
      <path className={styles.artSleeveOutline} d="M246 160 L286 122 L284 82" />
      <path className={styles.artSleeve} d="M246 160 L286 122 L284 82" />
      <circle className={styles.artSkin} cx="284" cy="72" r="13" />

      {/* Neck, head, face */}
      <rect className={styles.artSkin} x="202" y="126" width="16" height="20" rx="4" />
      <circle className={styles.artSkin} cx="210" cy="104" r="28" />
      <path className={styles.artHair} d="M182 104 C176 66 244 62 238 102 C230 84 200 82 184 106 Z" />
      <circle className={styles.artFeature} cx="200" cy="108" r="2.6" />
      <circle className={styles.artFeature} cx="220" cy="108" r="2.6" />
      <path className={styles.artSmile} d="M202 118 Q210 125 218 118" />

      {/* Stethoscope */}
      <path
        className={styles.artStethoscope}
        d="M196 144 C188 176 196 204 210 206 C224 204 232 176 224 144 M210 206 V214 C210 226 222 230 236 222"
      />
      <circle className={styles.artStethoscopeHead} cx="238" cy="220" r="6" />

      {/* Floating care motifs */}
      <path
        className={styles.artHeart}
        d="M92 132 C92 120 108 116 112 128 C116 116 132 120 132 132 C132 146 112 156 112 156 C112 156 92 146 92 132 Z"
      />
      <g transform="rotate(-35 336 270)">
        <rect className={styles.artPillA} x="312" y="260" width="24" height="20" rx="10" />
        <rect className={styles.artPillB} x="336" y="260" width="24" height="20" rx="10" />
        <rect className={styles.artPillB} x="330" y="260" width="12" height="20" />
      </g>
      <path className={styles.artPlus} d="M330 104 V128 M318 116 H342" />
      <path className={styles.artPlusAlt} d="M78 292 V310 M69 301 H87" />
      <circle className={styles.artSpark} cx="352" cy="176" r="4" />
      <circle className={styles.artSpark} cx="66" cy="196" r="3" />
      <circle className={styles.artSpark} cx="152" cy="64" r="3.5" />
    </svg>
  );
}
