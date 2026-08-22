import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'local-cert',
  description: "Let's Encrypt certificates for LAN hosts, via Route53 DNS-01",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="grid-bg min-h-screen">{children}</body>
    </html>
  );
}
