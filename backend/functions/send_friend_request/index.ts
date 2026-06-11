/**
 * send_friend_request — Edge Function (Deno)
 *
 * Validates and inserts a friend_request row, then sends a push notification
 * to the target child (if they have an Expo push token).
 *
 * Idempotent: duplicate pending request returns 200 with existing request id.
 *
 * Request body:
 * {
 *   from_child_id: string,
 *   to_child_id:   string,
 * }
 *
 * Response:
 * {
 *   requestId: string,
 *   status: 'created' | 'exists',
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
    // Push is best-effort — never fail the main request because of it
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

    const body = await req.json() as { from_child_id: string; to_child_id: string };
    const { from_child_id, to_child_id } = body;

    if (!from_child_id || !to_child_id) {
      return new Response(
        JSON.stringify({ error: 'MISSING_FIELDS', message: 'from_child_id and to_child_id are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (from_child_id === to_child_id) {
      return new Response(
        JSON.stringify({ error: 'SELF_REQUEST', message: 'Cannot send a friend request to yourself.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Verify both children exist and are active ──────────────────────────
    // expo_push_token is fetched separately (non-blocking) — this way the friend
    // request works even if migration 003 hasn't been applied yet.
    const { data: children, error: childError } = await supabase
      .from('child_profiles')
      .select('id, display_name')
      .in('id', [from_child_id, to_child_id])
      .eq('is_active', true);

    if (childError) throw childError;

    if (!children || children.length < 2) {
      return new Response(
        JSON.stringify({ error: 'CHILD_NOT_FOUND', message: 'One or both child profiles not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    type ChildRow = { id: string; display_name: string };
    const fromChild = (children as ChildRow[]).find((c) => c.id === from_child_id)!;
    const toChild   = (children as ChildRow[]).find((c) => c.id === to_child_id)!;

    // ── Check not already friends ─────────────────────────────────────────
    const { data: friendship } = await supabase
      .from('friendships')
      .select('child_id')
      .eq('child_id', from_child_id)
      .eq('friend_id', to_child_id)
      .maybeSingle();

    if (friendship) {
      return new Response(
        JSON.stringify({ error: 'ALREADY_FRIENDS', message: 'These children are already friends.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Idempotency: existing pending request ─────────────────────────────
    const { data: existing } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('from_child_id', from_child_id)
      .eq('to_child_id', to_child_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ requestId: existing.id, status: 'exists' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Insert request ─────────────────────────────────────────────────────
    const { data: newRequest, error: insertError } = await supabase
      .from('friend_requests')
      .insert({ from_child_id, to_child_id })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // ── Push notification to target (best-effort, non-blocking) ─────────────
    try {
      const { data: tokenRow } = await supabase
        .from('child_profiles')
        .select('expo_push_token')
        .eq('id', to_child_id)
        .single();
      const pushToken = (tokenRow as { expo_push_token?: string | null } | null)?.expo_push_token;
      if (pushToken) {
        await sendExpoPush(
          pushToken,
          '🤝 Novo pedido de amizade',
          `${fromChild.display_name} quer ser teu amigo!`,
          { type: 'friend_request', requestId: newRequest.id, fromChildId: from_child_id },
        );
      }
    } catch { /* push is best-effort — never fail the main request */ }

    return new Response(
      JSON.stringify({ requestId: newRequest.id, status: 'created' }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('send_friend_request error:', err);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
