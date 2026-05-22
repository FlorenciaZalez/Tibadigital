import type { CountryCode } from "@/lib/currency";

type CountryFlagProps = {
  country: CountryCode;
  className?: string;
};

const baseClassName = "inline-block h-5 w-5 overflow-hidden rounded-full align-middle shadow-sm";

export const CountryFlag = ({ country, className = "" }: CountryFlagProps) => {
  const combinedClassName = `${baseClassName} ${className}`.trim();

  if (country === "AR") {
    return (
      <svg viewBox="0 0 24 24" className={combinedClassName} aria-hidden="true">
        <defs>
          <clipPath id="flag-circle-ar">
            <circle cx="12" cy="12" r="12" />
          </clipPath>
        </defs>
        <g clipPath="url(#flag-circle-ar)">
          <rect width="24" height="24" fill="#75AADB" />
          <rect y="6" width="24" height="12" fill="#FFFFFF" />
          <circle cx="12" cy="12" r="1.9" fill="#FDBB30" />
          <circle cx="12" cy="12" r="0.45" fill="#9C5314" opacity="0.35" />
        </g>
      </svg>
    );
  }

  if (country === "UY") {
    return (
      <svg viewBox="0 0 24 24" className={combinedClassName} aria-hidden="true">
        <defs>
          <clipPath id="flag-circle-uy">
            <circle cx="12" cy="12" r="12" />
          </clipPath>
        </defs>
        <g clipPath="url(#flag-circle-uy)">
          <rect width="24" height="24" fill="#FFFFFF" />
          <rect y="2.66" width="24" height="2.66" fill="#3C86E8" />
          <rect y="8" width="24" height="2.66" fill="#3C86E8" />
          <rect y="13.34" width="24" height="2.66" fill="#3C86E8" />
          <rect y="18.68" width="24" height="2.66" fill="#3C86E8" />
          <rect width="10.5" height="10.5" fill="#FFFFFF" />
          <path
            d="m5.25 2.3.9 2.25 2.4-.15-1.82 1.58.65 2.3-2.13-1.27-2.02 1.27.56-2.3L1.98 4.4l2.38.15.89-2.25Z"
            fill="#FFD34D"
          />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={combinedClassName} aria-hidden="true">
      <defs>
        <clipPath id="flag-circle-other">
          <circle cx="12" cy="12" r="12" />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-circle-other)">
        <rect width="24" height="24" fill="#8ED8F8" />
        <path d="M0 7.4 4 5.8l3.1.5-.4 1.5-1.8.4-1.2 2.3-3.2 1.3L0 7.4Z" fill="#10B26C" />
        <path d="m6 9.8 1.5 1.8h2.2l1.4 2.4-.3 2-1.7 1.7v1.9L7.2 21v-2.7l-.7-2.1-1.8-.2L3.8 14l.1-1.8L6 9.8Z" fill="#10B26C" />
        <path d="m12.7 5.4 1.9-1.2H18l2.1 1.8-1.3 1.1-2.2-.3-1.2-1.4h-1.7l-1 .9.2 1.8 1.7.8 2.1-.3 1.1 1.4 2 .4 2.3-.7V24h-2.7l-1.4-1.6v-1.6l-1.8-3.9v-1.6l-.9-.7-2 .4-2.8-1.2-.5-2.8.9-1.2-.8-1.6Z" fill="#10B26C" />
      </g>
    </svg>
  );
};