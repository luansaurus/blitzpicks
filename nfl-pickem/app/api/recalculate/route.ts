export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recalculateStandings, recalculateLeaderboard } from '@/lib/server/recalculate';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    let isAuthorized = false;

    if (authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      const supabaseAuth = await createClient();
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (session) {
        const { data: profile } = await supabaseAuth.from('profiles').select('is_admin').eq('id', session.user.id).single();
        if (profile?.is_admin) isAuthorized = true;
      }
    }

    if (!isAuthorized) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const adminClient = createAdminClient();

    await recalculateStandings(adminClient);
    await recalculateLeaderboard(adminClient);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}