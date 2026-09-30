import { NextResponse } from 'next/server';
import { isAdminSession } from '@/utils/routeAuth';

export async function POST(request: Request) {
  try {
    // getUser() valida o token no Supabase. getSession() só lê o cookie e pode ser forjado.
    if (!(await isAdminSession())) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
    const syncUrl = new URL('/api/sync-games', baseUrl);

    // Secret no header (nunca na URL) e só no servidor
    const res = await fetch(syncUrl.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: `Falha interna: ${error.message}` }, { status: 500 });
  }
}
