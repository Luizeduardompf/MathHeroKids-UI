/**
 * respond_friend_request — Edge Function (Deno)
 *
 * Accepts or rejects a pending friend request.
 *
 * On accept:
 *  - Updates request status → 'accepted'
 *  - Inserts two friendship rows (bidirectional)
 *  - Sends push to the original requester
 *
 * On reject:
 *  - Updates request status → 'rejected'
 *  - No friendship rows
 *
 * Idempotent: already accepted/rejected request returns 200 with existing status.
 *
 * Request body:
 * {
 *   request_id: string,
 *   accept:     boolean,
 * }
 *
 * Response:
 * {
 *   status: 'accepted' | 'rejected' | 'already_responded',
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPush(token: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: 'default', badge: 1 }),
    });
  } catch {
    // Push is best-effort
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json() as { request_id: string; accept: boolean };
    const { request_id, accept } = body;

    if (!request_id || accept === undefined) {
      return new Response(
        JSON.stringify({ error: 'MISSING_FIELDS', message: 'request_id and accept are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Fetch request + child profiles ─────────────────────────────────────
    const { data: request, error: reqError } = await supabase
      .from('friend_requests')
      .select(`
        id, from_child_id, to_child_id, status,
        from_child:from_child_id (id, display_name, expo_push_token),
        to_child:to_child_id   (id, display_name, expo_push_token)
      `)
      .eq('id', request_id)
      .maybeSingle();

    if (reqError) throw reqError;

    if (!request) {
      return new Response(
        JSON.stringify({ error: 'NOT_FOUND', message: 'Friend request not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    type ChildInfo = { id: string; display_name: string; expo_push_token: string | null };
    const fromChild = (Array.isArray(request.from_child) ? request.from_child[0] : request.from_child) as ChildInfo;
    const toChild   = (Array.isArray(request.to_child)   ? request.to_child[0]   : request.to_child)   as ChildInfo;

    // ── Idempotency: already responded ────────────────────────────────────
    if (request.status !== 'pending') {
      return new Response(
        JSON.stringify({ status: 'already_responded', currentStatus: request.status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const newStatus = accept ? 'accepted' : 'rejected';

    // ── Update request status ─────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq('id', request_id);

    if (updateError) throw updateError;

    // ── On accept: insert bidirectional friendship rows ───────────────────
    if (accept) {
      const { error: friendError } = await supabase
        .from('friendships')
        .upsert([
          { child_id: request.from_child_id, friend_id: request.to_child_id },
          { child_id: request.to_child_id,   friend_id: request.from_child_id },
        ], { onConflict: 'child_id,friend_id' });

      if (friendError) throw friendError;

      // Push to requester: their request was accepted
      if (fromChild?.expo_push_token) {
        await sendExpoPush(
          fromChild.expo_push_token,
          '🎉 Pedido aceite!',
          `${toChild?.display_name ?? 'O teu amigo'} aceitou o teu pedido de amizade!`,
          { type: 'request_accepted', requestId: request_id, friendId: request.to_child_id },
        );
      }
    }

    return new Response(
      JSON.stringify({ status: newStatus }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('respond_friend_request error:', err);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
