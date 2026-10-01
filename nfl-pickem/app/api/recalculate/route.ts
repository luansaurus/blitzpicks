export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recalculateStandings, recalculateLeaderboard } from '@/lib/server/recalculate';
import { isAdminSession, isCronAuthorized } from '@/lib/server/auth';

export async function POST(request: Request) {
  if (!isCronAuthorized(request) && !(await isAdminSession())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  try {
    const adminClient = createAdminClient();
    await recalculateStandings(adminClient);
    await recalculateLeaderboard(adminClient);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[recalculate]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}