'use client';

import { useRouter } from 'next/navigation';

export function SignOut() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch('/api/admin/session', { method: 'DELETE' });
        router.replace('/login');
        router.refresh();
      }}
      className="text-ink-400 normal-case tracking-normal transition-colors hover:text-danger"
    >
      sortir
    </button>
  );
}
