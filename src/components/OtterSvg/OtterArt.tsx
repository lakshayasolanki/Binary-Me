import { useId } from "react";

// All coordinates are in the 1024 canvas the artwork was drawn on (floor line at y = 944), so the sitting
// otter's box is "286 521 486 423" and the poses that stand, sleep or think overflow it.
const BODY = "M314.7 803.5c11.6 6.4 16.6 32.4 30.6 42.1 9.4 6.5 23.9 5.2 34.9 6.3 24.9 2.5 49.6 6.5 74.5 8.2 10.1 0.7 25 4.7 33.7-0.5 2.8-9.5-1.7-21.2-4.4-30.6-6.5-23.4-11.3-61.8-37.1-72.2-10.8-4.4-53.7-2.4-59.2-7.8-2.6-2.4-1.2-6.9-3-9.9-5.1-8.6-12-14.4-9.7-25.5 0.7-3.9 2.7-7.8 2.2-11.8-0.6-5.2-4-10.5-5.6-15.4-3.7-11.3-2.4-21.2-1.3-32.6 1.4-13.5-18.3-21-2.6-41.8 8.5-11.1 22-5.1 31.6-11.3 37.3-24 87.7-40.4 130.5-18.3 13.7 7.1 23.3 20.6 34.8 30.3 8.1 6.8 19.3 3.4 25.6 13.9 2.1 3.5 4.9 35.4 4.2 37.7-2.1 7-10.9 14.2-9.5 21.2 2 10.3 5.2 25.3 9.7 34.6 7.3 15.1 20 27.8 26.2 43.6 5.4 13.5 9.4 46.2 14.6 54.8 4.6 7.8 29 5.1 37.4 5.9 11.6 1.1 64.1 19.8 72.7 27 2 1.7 1.8 4.6 3.5 6.6 4.1 4.6 18.6 4.6 14.8 22.1-1.8 7.9-29.6 13.1-37.3 15.1-8.2 2.1-11.4-1-18.7-1.7-3.4-0.3-7.8 1.4-11.6 1.5-5.1 0-9.1 5.9-14.6 6.8-12.6 2-33.1 0.9-46.2 0.1-10.1-0.6-20.5-6.4-30.9-4.9-21.4 3.1-21.4 11.5-36.2 15.8-5 1.5-8.9-3.6-14.3-1.8-4.9 1.7-4.2 8.6-8.7 9.5-5.9 1.1-12.7 4.6-18.7 4.5-6.3-0.1-13.1-3.7-19.3-1.2-6.6 2.7-8.5 10.6-16.8 11.7-2.7 0.4-16.9-0.6-18.6-2.2-4.5-4-4.7-13.3-12-14.6-3.1-0.6-5.5 2-8.6 1.9-7-0.3-14.3-6.1-21.2-6.9-3.6-0.4-6.4 2.6-10.1 2.2-7.6-0.8-17.5-0.7-25.1-2.7-2.4-0.7-4.3-2.8-6.8-3-8.1-0.5-8.9 12.4-19 8.6-4.9-1.8-8.4-7.8-11.8-11.4-2.2-2.4-5.2-2.7-7.6-4.6-5.5-4.2-11.2-20.9-11.7-27.9-0.4-6.5 3.7-12.9 1.7-19.1-5.7-17.9-21.3-33.5-25-52.3z";

/** The otter, drawn as vectors. Colors come from the --o-* custom properties set per theme in otterSvg.css. */
export function OtterArt() {
  const id = useId();
  const ref = (name: string) => `url(#${id}-${name})`;
  return (
    <>
      <defs>
        <path id={`${id}-body`} d={BODY} />
        <clipPath id={`${id}-clip`}>
          <use href={`#${id}-body`} />
        </clipPath>
        <linearGradient id={`${id}-lid`} x2="0.3" y2="1">
          <stop stopColor="var(--o-lid-a)" />
          <stop offset="1" stopColor="var(--o-lid-b)" />
        </linearGradient>
        <radialGradient id={`${id}-cream`}>
          <stop stopColor="var(--o-cream)" />
          <stop offset=".55" stopColor="var(--o-cream)" stopOpacity=".92" />
          <stop offset="1" stopColor="var(--o-cream)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="o-sit">
        <use href={`#${id}-body`} className="o-body" />
        <g clipPath={ref("clip")}>
          <ellipse cx="470" cy="805" rx="105" ry="125" fill={ref("cream")} />
          <ellipse cx="548" cy="722" rx="62" ry="48" fill={ref("cream")} />
          <ellipse cx="418" cy="738" rx="62" ry="26" fill={ref("cream")} />
          <ellipse cx="705" cy="868" rx="62" ry="24" fill={ref("cream")} opacity=".7" />
        </g>
        <path className="o-stroke" d="M641 818C652 842 654 872 646 903" />
        <ellipse className="o-pad" cx="359" cy="889" rx="18" ry="24" transform="rotate(-8 359 889)" />
        <ellipse className="o-pad" cx="499" cy="907" rx="24" ry="25" />

        <g className="o-laptop">
          <path className="o-lid" d="M293 749L448 762L484 866L339 853Z" fill={ref("lid")} />
          <path className="o-bevel" d="M302 758L441 771L473 853" />
          <path className="o-logo" d="M365 826C365 819 369 814 374 812C373 804 377 799 383 799C389 799 393 804 392 812C397 814 401 819 401 826C401 831 397 834 391 834L375 834C369 834 365 831 365 826Z" />
          <circle className="o-ink" cx="380" cy="809" r="1.6" />
          <circle className="o-ink" cx="388" cy="809" r="1.6" />
          <ellipse className="o-beak" cx="384" cy="813" rx="2.2" ry="1.5" />
          <path className="o-deck" d="M481 852L548 838Q556 836 557 843Q557 848 552 850L492 869Z" />
        </g>

        <g className="o-paws">
          <path className="o-stroke" d="M472 823C470 806 484 791 502 791C508 791 511 793 512 795" />
          <path className="o-stroke" d="M481 827C500 831 530 830 552 839" />
        </g>

        <g className="o-face">
          <circle className="o-ear" cx="520" cy="646" r="19" />
          <circle className="o-ear-in" cx="518" cy="650" r="9" />
          <path className="o-ear-far" d="M365 637C362 624 368 611 381 609" />
          <path className="o-stroke o-mouth-line" d="M383 741C397 751 421 753 441 750C462 747 481 741 491 733" />
          <path className="o-talk" d="M440 748C446 758 464 758 474 745C463 748 452 749 440 748Z" />
          <path className="o-nose" d="M411 724C411 719 422 718 429 718C437 718 446 719 446 725C446 733 438 738 429 738C419 738 411 733 411 724Z" />
          <path className="o-stroke o-stem" d="M431 737L432 746" />
          <circle className="o-eye" cx="498.5" cy="699" r="14.3" />
          <ellipse className="o-blush" cx="541" cy="716" rx="14" ry="9" transform="rotate(-35 541 716)" />
          <ellipse className="o-blush" cx="530" cy="731" rx="11" ry="7" transform="rotate(-20 530 731)" />
        </g>

        <g className="o-ticks">
          <path d="M393 528L417 566" />
          <path d="M438 531L433 561" />
          <path d="M379 557L398 575" />
        </g>
      </g>
    </>
  );
}
