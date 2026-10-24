import { useAnimating } from "./useAnimating";

/** Plain globe button. There is no translation yet, so `onClick` is where a language switch
 *  should be hooked up. */
export function LanguageButton({ onClick }: { onClick?: () => void }) {
  const [animating, animate] = useAnimating();

  return (
    <button
      type="button"
      data-animating={animating}
      onClick={() => {
        animate();
        onClick?.();
      }}
      className="icon-btn flex h-[18px] items-center"
      aria-label="Change language"
      title="Language"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
      </svg>
    </button>
  );
}
