/**
 * start_challenge — Edge Function (Deno)
 *
 * Creates or resumes a challenge_sessions row for the given child + date.
 * Idempotent: calling again for the same child + date returns the existing session.
 *
 * TODO Phase 2: Implement full logic.
 *
 * Expected request body:
 * {
 *   child_id: string,
 *   challenge_date: string,   // ISO date (YYYY-MM-DD)
 *   module_id: string,
 *   session_id: string,       // Client-generated UUID
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (_req: Request) => {
  // TODO Phase 2: full implementation
  return new Response(JSON.stringify({ error: 'Not implemented' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
});
