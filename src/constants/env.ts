import Constants from 'expo-constants';

/**
 * Type-safe environment variables.
 *
 * EXPO_PUBLIC_* vars are inlined at build time only when written as static
 * member expressions. A computed lookup (process.env[key]) is left untouched by
 * the transform and resolves to undefined in release bundles, where there is no
 * process.env to read from — so every var below must be spelled out literally.
 */

function requireEnv(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\nCopy .env.example to .env and fill in the values.`,
    );
  }
  return value;
}

export const env = {
  supabase: {
    url: requireEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
    anonKey: requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  },
  app: {
    env: (process.env.EXPO_PUBLIC_APP_ENV ?? 'development') as 'development' | 'staging' | 'production',
    version: Constants.expoConfig?.version ?? '1.0.0',
    name: Constants.expoConfig?.name ?? 'Math Hero Kids',
  },
} as const;

export const isDev = env.app.env === 'development';
export const isProd = env.app.env === 'production';
