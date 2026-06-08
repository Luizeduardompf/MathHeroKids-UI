// start_challenge — versão self-contained para Supabase Dashboard
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RETROACTIVE_WINDOW_DAYS = 7;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json() as {
      child_id: string;
      challenge_date: string;
      module_id: string;
      session_id: string;
      question_seed: string;
      timer_seconds: number;
      multiplication_max: number;
    };

    const { child_id, challenge_date, module_id, session_id, question_seed, timer_seconds, multiplication_max } = body;

    const today = new Date().toISOString().split('T')[0]!;
    const diffDays = Math.floor((new Date(today).getTime() - new Date(challenge_date).getTime()) / 86400000);

    if (diffDays < 0) {
      return new Response(
        JSON.stringify({ error: 'FUTURE_DATE', message: 'Cannot start a challenge for a future date.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const isRetroactive = diffDays > 0;
    if (isRetroactive && diffDays > RETROACTIVE_WINDOW_DAYS) {
      return new Response(
        JSON.stringify({ error: 'RETROACTIVE_WINDOW_EXPIRED', message: 'Outside 7-day window.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: existing } = await supabase
      .from('challenge_sessions')
      .select('id, status, correct_count')
      .eq('child_id', child_id)
      .eq('challenge_date', challenge_date)
      .eq('module_id', module_id)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'completed') {
        return new Response(
          JSON.stringify({ error: 'ALREADY_COMPLETED', message: 'Already completed.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ sessionId: existing.id, status: 'resumed', resumeFromIndex: existing.correct_count ?? 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: newSession, error: insertError } = await supabase
      .from('challenge_sessions')
      .insert({
        id: session_id, child_id, challenge_date, module_id, question_seed,
        status: 'in_progress', total_questions: 20, correct_count: 0, xp_awarded: 0,
        is_retroactive: isRetroactive, is_perfect: false, timer_seconds, multiplication_max,
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: race } = await supabase.from('challenge_sessions')
          .select('id, correct_count').eq('child_id', child_id).eq('challenge_date', challenge_date).single();
        if (race) return new Response(
          JSON.stringify({ sessionId: race.id, status: 'resumed', resumeFromIndex: race.correct_count ?? 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw insertError;
    }

    return new Response(
      JSON.stringify({ sessionId: newSession.id, status: 'new', resumeFromIndex: 0 }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('start_challenge error:', err);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
