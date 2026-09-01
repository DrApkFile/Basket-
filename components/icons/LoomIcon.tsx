import type { CSSProperties, SVGProps } from "react";

export type LoomIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  /** Render the green generating state with a restrained weaving animation. */
  active?: boolean;
  /** Icon size in CSS pixels; 16, 24–32, and 48–64 are supported. */
  size?: number | string;
  /** Optional accessible label. Decorative icons should omit this. */
  label?: string;
};

/**
 * Loom — Basket's abstract woven-thread AI mark.
 *
 * The mark is intentionally made from four calm, curved strands that overlap
 * into one closed orb-like form. It uses currentColor so the parent context
 * controls the color: white by default, or #00E28A while generating.
 */
export function LoomIcon({
  active = false,
  size = 32,
  label,
  className,
  style,
  ...props
}: LoomIconProps) {
  const mergedStyle: CSSProperties = {
    ...style,
    color: style?.color ?? (active ? "#00E28A" : "#FFFFFF"),
  };

  return (
    <svg
      {...props}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={mergedStyle}
    >
      <title>{label}</title>
      <style>{`
        @keyframes loom-weave-draw {
          0%, 100% { stroke-dashoffset: 0; opacity: 1; }
          50% { stroke-dashoffset: -18; opacity: .82; }
        }
        .loom-strand {
          vector-effect: non-scaling-stroke;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .loom-strand--active {
          animation: loom-weave-draw 4.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .loom-strand--active { animation: none; }
        }
      `}</style>

      <g
        className={active ? "loom-strand--active" : undefined}
        stroke="currentColor"
        strokeWidth="3.25"
        strokeDasharray={active ? "44 12" : undefined}
      >
        <path
          className="loom-strand"
          d="M16.2 20.1C22.1 12.3 36.8 10.6 46 18.4C54.9 25.9 53.7 39.2 44.1 46.2C34.5 53.2 20.3 51.2 15.5 42.1C11.7 34.8 12.5 25.1 16.2 20.1Z"
        />
        <path
          className="loom-strand"
          d="M20.1 16.2C27.9 10.3 41.6 13.3 47 22.4C52.4 31.5 47.4 44.3 38.1 48.2C28.7 52.1 16.4 45.8 14.3 35.8C12.8 28.5 15.1 19.9 20.1 16.2Z"
        />
        <path
          className="loom-strand"
          d="M43.8 16.2C51.6 22.1 53.4 35.9 46.2 44.5C39 53.1 25.8 52.2 18.3 44.2C10.8 36.3 13.3 23.3 21.5 17.1C28.2 12.1 38.8 12.5 43.8 16.2Z"
        />
        <path
          className="loom-strand"
          d="M47.8 21.1C54 29.1 49.8 42.2 40.2 47.2C30.5 52.2 17.9 47.3 15.8 37.1C13.8 27.1 21.5 16.2 31.8 14.6C38.4 13.6 44.1 16.3 47.8 21.1Z"
        />
      </g>

      <circle cx="32" cy="32" r="2.35" fill="currentColor" />
    </svg>
  );
}

export default LoomIcon;
