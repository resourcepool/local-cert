import type { ProviderType } from '@/lib/dns/provider-types';

/**
 * A small tile identifying a DNS host, shown wherever a provider is named.
 *
 * These are simplified marks in each host's colours, drawn here rather than
 * shipped as the official artwork. Colours are fixed (not theme tokens): a
 * brand reads the same on a dark and a light console.
 */
export function ProviderLogo({ type, size = 28 }: { type: ProviderType; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={LABEL[type]}
      className="shrink-0 rounded-md"
    >
      {MARK[type]}
    </svg>
  );
}

const LABEL: Record<ProviderType, string> = {
  aws: 'AWS',
  ovh: 'OVHcloud',
  gandi: 'Gandi',
  godaddy: 'GoDaddy',
  gcp: 'Google Cloud',
};

const text = {
  textAnchor: 'middle' as const,
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontWeight: 700,
};

const MARK: Record<ProviderType, React.ReactNode> = {
  aws: (
    <>
      <rect width="32" height="32" fill="#232f3e" />
      <text x="16" y="17" fontSize="11.5" fill="#fff" {...text}>
        aws
      </text>
      <path
        d="M7.5 21.2c5 3 12 3 17 0"
        fill="none"
        stroke="#ff9900"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="m22.4 19.6 2.6 1.3-1.3 2.5" fill="none" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  ovh: (
    <>
      <rect width="32" height="32" fill="#000e9c" />
      <text x="16" y="20" fontSize="11" letterSpacing=".3" fill="#fff" {...text}>
        OVH
      </text>
    </>
  ),
  gandi: (
    <>
      <rect width="32" height="32" fill="#111" />
      <text x="16" y="21.5" fontSize="19" fill="#fff" {...text}>
        g
      </text>
      <circle cx="24" cy="9" r="2.2" fill="#f4d03f" />
    </>
  ),
  godaddy: (
    <>
      <rect width="32" height="32" fill="#1bdbdb" />
      <text x="16" y="20.5" fontSize="12.5" fill="#111" {...text}>
        GD
      </text>
    </>
  ),
  gcp: (
    <>
      <rect width="32" height="32" fill="#fff" />
      <rect x=".5" y=".5" width="31" height="31" rx="5.5" fill="none" stroke="#dadce0" />
      <path d="M10.2 21.5a4.3 4.3 0 0 1-.6-8.5" fill="none" stroke="#fbbc04" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M9.6 13a6.6 6.6 0 0 1 10.6-2.6" fill="none" stroke="#ea4335" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M20.2 10.4a6.6 6.6 0 0 1 2.3 4.4 3.4 3.4 0 0 1-.6 6.7" fill="none" stroke="#4285f4" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21.9 21.5H10.2" fill="none" stroke="#34a853" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
};
