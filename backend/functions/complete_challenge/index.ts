/**
 * complete_challenge — Edge Function (Deno)
 *
 * Receives the full session payload after a challenge is finished.
 * Validates all answers, awards XP, updates level/streak/calendar,
 * evaluates trophies and achievements, and returns the result.
 *
 * This is the ONLY way XP and progression are mutated — never via
 * direct client writes to child_profiles.
 *
 * TODO Phase 2: Implement full logic.
 *
 * Expected request body:
 * {
 *   child_id: string,
 *   challenge_date: string,        // ISO date (YYYY-MM-DD)
 *   session_id: string,            // Client-generated UUID (idempotency key)
 *   module_id: string,
 *   timer_seconds: number,
 *   multiplication_max: number,
 *   answers: Array<{
 *     question_index: number,
 *     block_number: number,
 *     attempt_number: number,
 *     operand_a: number,
 *     operand_b: number,
 *     child_answer: number | null,
 *     time_taken_ms: number | null,
 *   }>
 * }
 *
 * Response: CompleteChallengeResponse (see src/types/database.types.ts)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req: Request) => {
  // TODO Phase 2: full implementation
  return new Response(JSON.stringify({ error: 'Not implemented' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
});
