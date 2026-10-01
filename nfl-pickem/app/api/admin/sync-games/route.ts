import { NextResponse } from 'next/server';
import { isAdminSession } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    if (!(await isAdminSession())) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
    const syncUrl = new URL('/api/sync-games', baseUrl);

    const res = await fetch(syncUrl.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    // Vamos cuspir o erro real no terminal e na resposta da rede!
    console.error("ERRO FATAL NA API:", error);
    return NextResponse.json({ 
      error: `Falha interna: ${error.message}`,
      stack: error.stack 
    }, { status: 500 });
  }
}