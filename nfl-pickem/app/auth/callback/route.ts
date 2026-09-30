import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Só aceita caminhos internos. Bloqueia `//evil.com`, `/\\evil.com`, `https://...`, etc.
 * (antes, `${origin}${next}` com next="@evil.com" resultava em redirect para outro domínio).
 */
function getSafeRedirectPath(next: string | null, fallback = '/dashboard') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  try {
    const base = 'http://localhost';
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Onde o usuário deve ir após confirmar o e-mail
  const next = getSafeRedirectPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Se algo der errado, manda para o login
  return NextResponse.redirect(`${origin}/login`);
}