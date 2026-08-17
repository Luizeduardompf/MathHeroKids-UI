/**
 * list_all_children — Edge Function (Deno)
 *
 * Lista TODOS os pares pai-criança do sistema (todas as contas, não só a do parent
 * autenticado) — usado pela tela "Developers" > "Resetar progresso" para o dev escolher
 * qualquer criança de qualquer conta de teste. Requer só um parent autenticado (mesmo
 * padrão de update_app_config — a tela já double-gate com PIN + senha fixa antes de chegar
 * aqui; isto não é uma área de dados sensíveis de terceiros protegida por ownership, é uma
 * ferramenta "para nós").
 *
 * Response:
 * { ok: boolean, parents?: Array<{
 *     parent_id: string, parent_name: string,
 *     children: Array<{ id, display_name, username, avatar_id, xp_total, level }>
 *   }>, error?: string, message?: string }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

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

    const { data: parents, error: parentsError } = await supabaseAdmin
      .from('parent_profiles')
      .select('id, name')
      .order('name');
    if (parentsError) throw parentsError;

    const { data: children, error: childrenError } = await supabaseAdmin
      .from('child_profiles')
      .select('id, parent_id, display_name, username, avatar_id, xp_total, level')
      .eq('is_active', true)
      .order('sort_order');
    if (childrenError) throw childrenError;

    const childrenByParent = new Map<string, typeof children>();
    for (const child of children ?? []) {
      const list = childrenByParent.get(child.parent_id) ?? [];
      list.push(child);
      childrenByParent.set(child.parent_id, list);
    }

    const result = (parents ?? [])
      .map((p) => ({
        parent_id: p.id,
        parent_name: p.name,
        children: (childrenByParent.get(p.id) ?? []).map((c) => ({
          id: c.id,
          display_name: c.display_name,
          username: c.username,
          avatar_id: c.avatar_id,
          xp_total: c.xp_total,
          level: c.level,
        })),
      }))
      .filter((p) => p.children.length > 0);

    return json({ ok: true, parents: result });

  } catch (err) {
    console.error('list_all_children error:', err);
    return json({ ok: false, error: 'INTERNAL_ERROR', message: (err as Error).message }, 500);
  }
});
