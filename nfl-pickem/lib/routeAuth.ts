import { createClient } from './supabase/server';

export async function isAdminSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
    
  return !!profile?.is_admin;
}

export function isCronAuthorized(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  
  if (!expectedSecret) {
    return false;
  }

  // 1. Verifica a palavra-passe pelo cabeçalho (Padrão Vercel Cron)
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${expectedSecret}`) {
    return true;
  }

  // 2. Verifica a palavra-passe pelo endereço URL (Cron externo ou manual)
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  if (querySecret === expectedSecret) {
    return true;
  }

  return false;
}