/**
 * verify_parent_pin — Edge Function (Deno)
 *
 * Manages the parent's 4-digit PIN using bcrypt (server-side only).
 * PIN hash stored in parent_profiles.pin_hash — never returned to client.
 *
 * Actions:
 *   verify      — check PIN against stored hash
 *   set         — set PIN for the first time (requires no existing pin_hash)
 *   change      — change PIN (requires current_pin + new_pin)
 *   clear       — remove PIN (requires current_pin)
 *
 * Brute-force protection:
 *   5 failed attempts → 30-min lockout per parent.
 *   Stored in-memory per EF instance (resets on cold start — acceptable for MVP).
 *
 * Request body:
 * {
 *   action:       'verify' | 'set' | 'change' | 'clear',
 *   pin?:         string,   // 4-digit — required for verify, set, clear
 *   current_pin?: string,   // required for change, clear
 *   new_pin?:     string,   // required for change
 * }
 *
 * Response:
 * { ok: boolean, error?: string }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore — bcryptjs types not bundled, works at runtime
import * as bcrypt from 'npm:bcryptjs';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PIN_REGEX = /^\d{4}$/;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes

// In-memory rate limiting (per EF instance — acceptable for MVP)
const attempts = new Map<string, { count: number; firstAt: number }>();

function isLocked(parentId: string): boolean {
  const a = attempts.get(parentId);
  if (!a) return false;
  if (Date.now() - a.firstAt > LOCKOUT_MS) { attempts.delete(parentId); return false; }
  return a.count >= MAX_ATTEMPTS;
}
function recordFailure(parentId: string) {
  const a = attempts.get(parentId);
  if (!a || Date.now() - a.firstAt > LOCKOUT_MS) { attempts.set(parentId, { count: 1, firstAt: Date.now() }); }
  else { a.count++; }
}
function clearAttempts(parentId: string) { attempts.delete(parentId); }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

    // Auth client to identify the parent
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

    const parentId = user.id;
    if (isLocked(parentId)) {
      return json({ ok: false, error: 'TOO_MANY_ATTEMPTS', message: 'Muitas tentativas. Tente novamente em 30 minutos.' }, 429);
    }

    const body = await req.json() as {
      action: 'verify' | 'set' | 'change' | 'clear';
      pin?: string;
      current_pin?: string;
      new_pin?: string;
    };
    const { action, pin, current_pin, new_pin } = body;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('parent_profiles')
      .select('pin_hash')
      .eq('id', parentId)
      .single();
    if (profileError) throw profileError;

    const currentHash: string | null = (profile as { pin_hash: string | null }).pin_hash;

    // ── verify ────────────────────────────────────────────────────────────
    if (action === 'verify') {
      if (!pin || !PIN_REGEX.test(pin)) return json({ ok: false, error: 'INVALID_PIN' }, 400);
      if (!currentHash) return json({ ok: false, error: 'PIN_NOT_SET' }, 400);
      const match = await bcrypt.compare(pin, currentHash);
      if (!match) { recordFailure(parentId); return json({ ok: false, error: 'WRONG_PIN' }, 401); }
      clearAttempts(parentId);
      return json({ ok: true });
    }

    // ── set ───────────────────────────────────────────────────────────────
    if (action === 'set') {
      if (!pin || !PIN_REGEX.test(pin)) return json({ ok: false, error: 'INVALID_PIN' }, 400);
      if (currentHash) return json({ ok: false, error: 'PIN_ALREADY_SET' }, 409);
      const hash = await bcrypt.hash(pin, 10);
      const { error: updateError } = await supabaseAdmin.from('parent_profiles').update({ pin_hash: hash }).eq('id', parentId);
      if (updateError) throw updateError;
      return json({ ok: true });
    }

    // ── change ────────────────────────────────────────────────────────────
    if (action === 'change') {
      if (!current_pin || !new_pin) return json({ ok: false, error: 'MISSING_FIELDS' }, 400);
      if (!PIN_REGEX.test(current_pin) || !PIN_REGEX.test(new_pin)) return json({ ok: false, error: 'INVALID_PIN' }, 400);
      if (!currentHash) return json({ ok: false, error: 'PIN_NOT_SET' }, 400);
      const match = await bcrypt.compare(current_pin, currentHash);
      if (!match) { recordFailure(parentId); return json({ ok: false, error: 'WRONG_PIN' }, 401); }
      const newHash = await bcrypt.hash(new_pin, 10);
      const { error: updateError } = await supabaseAdmin.from('parent_profiles').update({ pin_hash: newHash }).eq('id', parentId);
      if (updateError) throw updateError;
      clearAttempts(parentId);
      return json({ ok: true });
    }

    // ── clear ─────────────────────────────────────────────────────────────
    if (action === 'clear') {
      if (!pin || !PIN_REGEX.test(pin)) return json({ ok: false, error: 'INVALID_PIN' }, 400);
      if (!currentHash) return json({ ok: true }); // already no PIN — idempotent
      const match = await bcrypt.compare(pin, currentHash);
      if (!match) { recordFailure(parentId); return json({ ok: false, error: 'WRONG_PIN' }, 401); }
      const { error: updateError } = await supabaseAdmin.from('parent_profiles').update({ pin_hash: null }).eq('id', parentId);
      if (updateError) throw updateError;
      clearAttempts(parentId);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'UNKNOWN_ACTION' }, 400);

  } catch (err) {
    console.error('verify_parent_pin error:', err);
    return json({ ok: false, error: 'INTERNAL_ERROR', message: (err as Error).message }, 500);
  }
});
