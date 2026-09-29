import { timingSafeEqual } from 'crypto';
import { createClient } from '@/utils/server';

/** Comparação em tempo constante, para não vazar o secret por diferença de tempo de resposta. */
function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Autoriza chamadas de cron/automação usando o CRON_SECRET.
 *
 * Aceita:
 *  - Header `Authorization: Bearer <CRON_SECRET>` (recomendado; é o que o Vercel Cron envia
 *    automaticamente quando a env CRON_SECRET está definida no projeto)
 *  - Query `?secret=<CRON_SECRET>` (LEGADO: mantido só para não quebrar cron externo que
 *    você já tenha configurado. Secrets em URL vão parar em logs; migre para o header.)
 */
export function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && safeEqual(authHeader.slice(7), expected)) {
    return true;
  }

  const querySecret = new URL(request.url).searchParams.get('secret');
  return !!querySecret && safeEqual(querySecret, expected);
}

/**
 * Verifica, NO SERVIDOR, se quem chamou tem sessão válida e profiles.is_admin = true.
 * Usa supabase.auth.getUser() (valida o token no Supabase), não getSession().
 */
export async function isAdminSession(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    return profile?.is_admin === true;
  } catch {
    return false;
  }
}
