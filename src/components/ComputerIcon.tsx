import { useId, type SVGProps } from "react";

/** Beige desktop terminal and keyboard, drawn as vectors from the reference. */
export function ComputerIcon({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  const id = useId();
  return (
    <svg className={`computer ${className}`} viewBox="0 0 64 66" aria-hidden="true" focusable="false" {...props}>
      <defs>
        <linearGradient id={`${id}-case`} x2="0.8" y2="1">
          <stop stopColor="var(--computer-case-light)" />
          <stop offset="1" stopColor="var(--computer-case-dark)" />
        </linearGradient>
        <linearGradient id={`${id}-base`} x2="0.9" y2="1">
          <stop stopColor="var(--computer-base-light)" />
          <stop offset="1" stopColor="var(--computer-base-dark)" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x2="1" y2="1">
          <stop stopColor="var(--computer-glass-light)" />
          <stop offset="1" stopColor="var(--computer-glass-dark)" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x2="0" y2="1">
          <stop stopColor="#fff" stopOpacity=".75" />
          <stop offset=".35" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".42" />
        </linearGradient>
        <linearGradient id={`${id}-glare`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" stopOpacity=".3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="computer__monitor">
        <path d="M52 2.5h3.5c3.6 0 6.5 2.9 6.5 6.5v30c0 2.8-2.2 5-5 5H52Z" fill={`url(#${id}-base)`} />
        <path d="M52 2.5h3.5c3.6 0 6.5 2.9 6.5 6.5v30c0 2.8-2.2 5-5 5H52Z" fill="#000" opacity=".5" />
        <rect x="5" y="3" width="54" height="44" rx="8" fill="#000" opacity=".28" />
        <rect x="5" y="1" width="54" height="44" rx="8" fill={`url(#${id}-case)`} />
        <rect x="5" y="1" width="54" height="44" rx="8" fill={`url(#${id}-shine)`} />
        <rect x="5.5" y="1.5" width="53" height="43" rx="7.5" fill="none" stroke="#fff" strokeOpacity=".5" />
        <rect x="13" y="2.6" width="28" height="2" rx="1" fill="#fff" opacity=".6" />
        <g className="computer__screen">
          <rect x="10.5" y="6.5" width="43" height="29" rx="5.5" fill="#000" opacity=".35" />
          <rect x="11" y="7" width="42" height="28" rx="5" fill={`url(#${id}-glass)`} />
          <path d="M16 7h24L25 35H16a5 5 0 0 1-5-5V12a5 5 0 0 1 5-5Z" fill={`url(#${id}-glare)`} />
          <g fill="none" stroke="var(--computer-prompt)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path className="computer__chevron" pathLength="1" d="m19 15 5.5 5.5L19 26" />
            <path className="computer__cursor" d="M29 26.5h8" />
          </g>
        </g>
        <circle cx="49" cy="40.2" r="1.8" fill="var(--computer-detail)" />
      </g>
      <g className="computer__keyboard">
        <path d="M2 58h60v3.5a3.5 3.5 0 0 1-3.5 3.5h-53A3.5 3.5 0 0 1 2 61.5Z" fill={`url(#${id}-base)`} />
        <path d="M9 48h46c2.2 0 3.5 1.1 4.2 3L63 58.5c.6 1.7-.8 2.8-3 2.8H4c-2.2 0-3.6-1.1-3-2.8l3.8-7.5C5.5 49.1 6.8 48 9 48Z" fill={`url(#${id}-case)`} />
        <path d="M9 48h46c2.2 0 3.5 1.1 4.2 3L63 58.5c.6 1.7-.8 2.8-3 2.8H4c-2.2 0-3.6-1.1-3-2.8l3.8-7.5C5.5 49.1 6.8 48 9 48Z" fill={`url(#${id}-shine)`} />
        <g className="computer__keys" fill="var(--computer-keys)">
          <g><rect x="9" y="51.5" width="12" height="3.6" rx="1.2" fill="#000" opacity=".3" /><rect x="9" y="50.5" width="12" height="3.6" rx="1.2" /></g>
          <g><rect x="26" y="51.5" width="12" height="3.6" rx="1.2" fill="#000" opacity=".3" /><rect x="26" y="50.5" width="12" height="3.6" rx="1.2" /></g>
          <g><rect x="43" y="51.5" width="12" height="3.6" rx="1.2" fill="#000" opacity=".3" /><rect x="43" y="50.5" width="12" height="3.6" rx="1.2" /></g>
          <g><rect x="14" y="56.6" width="36" height="3.2" rx="1.2" fill="#000" opacity=".3" /><rect x="14" y="55.6" width="36" height="3.2" rx="1.2" /></g>
        </g>
      </g>
    </svg>
  );
}
