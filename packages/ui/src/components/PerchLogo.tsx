/**
 * Perch Logomark — "The Signal"
 *
 * Concept: Three concentric arcs radiating upward from a single anchor point,
 * like a radar pulse or broadcast signal transmitted from elevation.
 *
 * The anchor point represents the perch itself — the high vantage point from
 * which a developer observes their entire local infrastructure. The arcs represent
 * the signal: real-time awareness broadcasting outward in all directions.
 *
 * Design decisions:
 * - Stroke-only (no fills): communicates precision and technical accuracy
 * - Three arcs: represents signal strength / layers of observability
 *   (processes → ports → logs → the full picture)
 * - Upper-right radiance: suggests forward momentum and upward visibility
 * - No containing shape: the mark stands freely, unboxed — like the product itself,
 *   which removes the box (the terminal window) and surfaces what's inside
 * - Monoline weight: consistent with developer tooling aesthetics (Linear, Raycast)
 *
 * Usage: Always render in var(--accent). Never add a background container.
 * Minimum render size: 14px. Preferred titlebar size: 18px.
 */

interface PerchLogoProps {
  size?: number;
  color?: string;
}

export function PerchLogo({ size = 18, color = "currentColor" }: PerchLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Perch"
    >
      <line
        x1="5"
        y1="14"
        x2="5"
        y2="11"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 11A3 3 0 0 1 8 8"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5 11A6 6 0 0 1 11 5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5 11A9 9 0 0 1 14 2"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
