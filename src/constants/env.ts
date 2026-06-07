import Constants from 'expo-constants';

/**
 * Type-safe environment variables.
 * All EXPO_PUBLIC_* vars are inlined at build time by Metro.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\nCopy .env.example to .env and fill in the values.`,
    );
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  supabase: {
    url: requireEnv('EXPO_PUBLIC_SUPABASE_URL'),
    anonKey: requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  },
  app: {
    env: optionalEnv('EXPO_PUBLIC_APP_ENV', 'development') as 'development' | 'staging' | 'production',
    version: Constants.expoConfig?.version ?? '1.0.0',
    name: Constants.expoConfig?.name ?? 'Math Hero Kids',
  },
} as const;

export const isDev = env.app.env === 'development';
export const isProd = env.app.env === 'production';
