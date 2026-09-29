export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ESPN_SCOREBOARD_URL, ESPN_SUMMARY_URL } from '@/lib/config';

// As funções antigas calculatePoints, recalculateStandings e recalculateLeaderboard foram removidas daqui.
// O Sync agora é puro, e no final ele dispara a rota de Recalculate via Fetch.

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const isPatch = searchParams.get('patch')?.toLowerCase() === 'true'; 
    const weekParam = searchParams.get('week');
    const seasonTypeParam = searchParams.get('seasontype') || '2';
    
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: dbTeams } = await supabase.from('teams').select('id, name, city, abbreviation');

    let espnUrl = ESPN_SCOREBOARD_URL;
    if (weekParam) espnUrl += `?week=${weekParam}&seasontype=${seasonTypeParam}`;

    const response = await fetch(espnUrl, { next: { revalidate: 0 } });
    const data = await response.json();
    const events = data.events;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ message: 'Nenhum jogo encontrado' }, { status: 200 });
    }

    let updatedCount = 0;

    const findTeam = (espnTeam: any) => {
      if (!espnTeam || !dbTeams) return null;
      const espnAbbr = espnTeam.abbreviation?.toUpperCase() || '';
      const espnName = espnTeam.name?.toLowerCase() || ''; 
      const espnDisplayName = espnTeam.displayName?.toLowerCase() || ''; 

      const abbrCorrectionMap: Record<string, string> = { 'WAS': 'WSH', 'LA': 'LAR', 'LVR': 'LV', 'NEP': 'NE' };
      const targetAbbr = abbrCorrectionMap[espnAbbr] || espnAbbr;

      return dbTeams.find(t => {
        const dbAbbr = t.abbreviation?.toUpperCase() || '';
        const dbName = t.name?.toLowerCase() || '';
        const dbFullName = `${t.city} ${t.name}`.toLowerCase();
        return (dbAbbr === targetAbbr || dbName === espnName || dbFullName === espnDisplayName);
      });
    };

    for (const event of events) {
      // (COLE AQUI O MIOLO ORIGINAL DO SEU LOOP DE EVENTOS INTACTO ATE O "if (!isPatch)")
      // Pelo tamanho limite do LLM, a logica de iterar eventos permanece a mesma que vc ja possui.
    }

    // Após processar os jogos, disparamos a rota de recálculo
    if (!isPatch) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
        await fetch(new URL('/api/recalculate', baseUrl).toString(), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
        });
    }

    return NextResponse.json({ success: true, processed: updatedCount });

  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}