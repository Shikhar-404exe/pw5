/**
 * Mira's visual identity mark.
 * Decorative only: hidden from assistive technology so it never interferes
 * with screen-reader navigation.
 */
export function MiraAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg
      className="mira-avatar"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="mira-halo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4C6FFF" />
          <stop offset="55%" stopColor="#8B6CFF" />
          <stop offset="100%" stopColor="#3EC9DF" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill="#16181E" stroke="url(#mira-halo)" strokeWidth="2" />
      <path
        d="M15 31 L15 18 L24 27 L33 18 L33 31"
        fill="none"
        stroke="url(#mira-halo)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="mira-glow" cx="36" cy="13" r="3" fill="#3EC9DF" />
    </svg>
  );
}
