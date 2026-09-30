import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Chama a rota original de sync passando o secret via servidor
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
    const syncUrl = new URL('/api/sync-games', baseUrl);
    syncUrl.searchParams.set('secret', process.env.CRON_SECRET || '');

    const res = await fetch(syncUrl.toString(), { method: 'GET' });
    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: `Falha interna: ${error.message}` }, { status: 500 });
  }
}