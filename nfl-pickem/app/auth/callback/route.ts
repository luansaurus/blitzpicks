import { NextResponse } from 'next/server';
import { createClient } from '@/utils/server'; // Ajuste o caminho para o seu client server

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Onde o usuário deve ir após confirmar o e-mail
  const next = searchParams.get('next') ?? '/dashboard'; 

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