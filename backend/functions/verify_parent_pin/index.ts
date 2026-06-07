/**
 * verify_parent_pin — Edge Function (Deno)
 *
 * Verifies a 4-digit parent PIN using bcrypt (server-side only).
 * PIN hash is stored in parent_profiles.pin_hash and is NEVER returned to the client.
 *
 * Also handles: set_pin (first-time setup) and change_pin.
 *
 * TODO Phase 7: Implement full logic.
 *
 * Expected request body:
 * {
 *   action: 'verify' | 'set' | 'change',
 *   pin: string,                // 4-digit string
 *   current_pin?: string,       // required for 'change' action
 * }
 *
 * Brute-force protection: 5 failed attempts → 30 min lockout (tracked server-side).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (_req: Request) => {
  // TODO Phase 7: full implementation
  return new Response(JSON.stringify({ error: 'Not implemented' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
});
