import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'pg', 'acme-client'],
  experimental: {
    // instrumentation.ts runs the in-process ACME worker + renewal scheduler
  },
};

export default config;
