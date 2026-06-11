/**
 * cancel_friend_request — Edge Function (Deno)
 *
 * Allows the SENDER of a pending friend request to cancel it.
 * Sets status → 'cancelled'. Idempotent: already-cancelled returns 200.
 *
 * Request body:
 * {
 *   request_id:    string,   // UUID of the friend_request row
 *   from_child_id: string,   // must match from_child_id — prevents spoofing
 * }
 *
 * Response:
 * { status: 'cancelled' | 'already_cancelled' | 'not_found' | 'forbidden' }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json() as { request_id: string; from_child_id: string };
    const { request_id, from_child_id } = body;

    if (!request_id || !from_child_id) {
      return new Response(
        JSON.stringify({ error: 'MISSING_FIELDS', message: 'request_id and from_child_id are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Fetch request ─────────────────────────────────────────────────────────
    const { data: request, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, from_child_id, status')
      .eq('id', request_id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!request) {
      return new Response(
        JSON.stringify({ error: 'NOT_FOUND', message: 'Friend request not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Ownership check ───────────────────────────────────────────────────────
    if (request.from_child_id !== from_child_id) {
      return new Response(
        JSON.stringify({ error: 'FORBIDDEN', message: 'Only the sender can cancel this request.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Idempotency ───────────────────────────────────────────────────────────
    if (request.status === 'cancelled') {
      return new Response(
        JSON.stringify({ status: 'already_cancelled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (request.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'ALREADY_RESPONDED', message: `Request already ${request.status}.` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Cancel ────────────────────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', request_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ status: 'cancelled' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('cancel_friend_request error:', err);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
