export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCronAuthorized } from '@/utils/routeAuth';
import { ESPN_SCOREBOARD_URL, ESPN_SUMMARY_URL } from '@/lib/config';
import { findTeam, extractFullRoster, getTeamStat, getKicks, getPunts } from '@/lib/server/espn';
import { recalculateStandings, recalculateLeaderboard } from '@/lib/server/recalculate';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPatch = searchParams.get('patch')?.toLowerCase() === 'true'; 
    const weekParam = searchParams.get('week');
    const seasonTypeParam = searchParams.get('seasontype') || '2';
    
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

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

    for (const event of events) {
      const statusName = event?.status?.type?.name || '';
      const statusState = event?.status?.type?.state || ''; 
      
      const isFinished = statusName === 'STATUS_FINAL' || statusState === 'post';
      const isHalftime = statusName === 'STATUS_HALFTIME';
      const isInProgress = statusName === 'STATUS_IN_PROGRESS' || isHalftime || statusState === 'in';
      
      const period = event?.status?.period || '';
      const displayClock = event?.status?.displayClock || '';
      
      let clockString = '';
      if (isFinished) clockString = 'FINAL';
      else if (isHalftime) clockString = 'HALFTIME';
      else if (isInProgress) clockString = `${period}Q - ${displayClock}`;

      const competition = event?.competitions?.[0];
      if (!competition) continue;

      const homeData = competition.competitors?.find((c: any) => c.homeAway === 'home');
      const awayData = competition.competitors?.find((c: any) => c.homeAway === 'away');

      const homeScore = parseInt(homeData?.score || '0');
      const awayScore = parseInt(awayData?.score || '0');

      const homeTeam = findTeam(homeData?.team, dbTeams || []);
      const awayTeam = findTeam(awayData?.team, dbTeams || []);

      if (!homeTeam || !awayTeam) continue;

      let espnWeek = event?.week?.number?.toString() || '1';
      if (event?.season?.type === 3) {
        if (espnWeek === '1') espnWeek = 'WC';
        else if (espnWeek === '2') espnWeek = 'DR';
        else if (espnWeek === '3') espnWeek = 'CC';
        else if (espnWeek === '4' || espnWeek === '5') espnWeek = 'SB'; 
      }

      const { data: gameCheck } = await supabase.from('games')
        .select('id, status, meta_data')
        .eq('home_team_id', homeTeam.id)
        .eq('away_team_id', awayTeam.id)
        .eq('week', espnWeek)
        .maybeSingle();
        
      if (!gameCheck) continue;

      const dbMeta = gameCheck.meta_data as any;
      const hasDefenders = (dbMeta?.leaders?.home?.some((l: any) => l.category === 'SACKS' || l.category === 'INTERCEPTIONS')) || 
                           (dbMeta?.leaders?.away?.some((l: any) => l.category === 'SACKS' || l.category === 'INTERCEPTIONS'));
      
      if (gameCheck.status === 'finished' && hasDefenders && !isPatch) {
          continue; 
      }

      let homeLeaders: any[] = [];
      let awayLeaders: any[] = [];
      let rawBoxscore: any = null;
      let rawCompetition: any = null;

      if (isInProgress || isFinished || isPatch) {
        try {
          const summaryRes = await fetch(`${ESPN_SUMMARY_URL}?event=${event.id}`, { next: { revalidate: 0 } });
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            rawBoxscore = summaryData.boxscore; 
            rawCompetition = competition;
            
            homeLeaders = extractFullRoster(homeData?.team?.id, summaryData);
            awayLeaders = extractFullRoster(awayData?.team?.id, summaryData);

            const homeSacks = parseInt(getTeamStat(awayData?.team?.id, "sacksYardsLost", summaryData).split("-")[0]) || 0;
            const homeInts = parseInt(getTeamStat(awayData?.team?.id, "interceptions", summaryData)) || 0;
            const homeFums = parseInt(getTeamStat(awayData?.team?.id, "fumblesLost", summaryData)) || 0;

            const awaySacks = parseInt(getTeamStat(homeData?.team?.id, "sacksYardsLost", summaryData).split("-")[0]) || 0;
            const awayInts = parseInt(getTeamStat(homeData?.team?.id, "interceptions", summaryData)) || 0;
            const awayFums = parseInt(getTeamStat(homeData?.team?.id, "fumblesLost", summaryData)) || 0;

            homeLeaders.push({ category: 'TEAM_DEF', name: 'Team Defense', stat: `${homeSacks} Sacks, ${homeInts} INT, ${homeFums} Fum. Rec.` });
            homeLeaders.push({ category: 'TEAM_ST', name: 'Special Teams', stat: `${getKicks(homeData?.team?.id, "FG", summaryData)} FG | ${getKicks(homeData?.team?.id, "XP", summaryData)} XP | ${getPunts(homeData?.team?.id, summaryData)} Punts` });

            awayLeaders.push({ category: 'TEAM_DEF', name: 'Team Defense', stat: `${awaySacks} Sacks, ${awayInts} INT, ${awayFums} Fum. Rec.` });
            awayLeaders.push({ category: 'TEAM_ST', name: 'Special Teams', stat: `${getKicks(awayData?.team?.id, "FG", summaryData)} FG | ${getKicks(awayData?.team?.id, "XP", summaryData)} XP | ${getPunts(awayData?.team?.id, summaryData)} Punts` });
          }
        } catch (e) {
          console.error(`Falha ao buscar summary do jogo ${event.id}`, e);
        }
      }

      const broadcastStr = competition?.broadcasts?.[0]?.names?.[0] || dbMeta?.broadcast || '';
      const oddsDetails = competition?.odds?.[0]?.details || dbMeta?.odds?.details || '';
      const overUnder = competition?.odds?.[0]?.overUnder || dbMeta?.odds?.overUnder || '';

      const metaData = {
        linescores: {
          home: homeData?.linescores?.map((l: any) => l.value) || dbMeta?.linescores?.home || [],
          away: awayData?.linescores?.map((l: any) => l.value) || dbMeta?.linescores?.away || []
        },
        leaders: { home: homeLeaders, away: awayLeaders },
        broadcast: broadcastStr,
        odds: { details: oddsDetails, overUnder: overUnder },
        raw_boxscore: rawBoxscore || dbMeta?.raw_boxscore || null,
        raw_competition: rawCompetition || dbMeta?.raw_competition || null
      };

      if (isPatch) {
          const { error } = await supabase.from('games').update({ meta_data: metaData }).eq('id', gameCheck.id);
          if (!error) updatedCount++;
      } else {
          let dbStatus = 'pending';
          if (isFinished) dbStatus = 'finished';
          else if (isInProgress) dbStatus = 'in_progress';

          const { error } = await supabase.from('games').update({
              home_score: homeScore,
              away_score: awayScore,
              status: dbStatus,
              clock: clockString,
              meta_data: metaData
          }).eq('id', gameCheck.id);
          
          if (!error) updatedCount++;
      }
    }

    if (!isPatch) {
        await recalculateStandings(supabase);
        await recalculateLeaderboard(supabase);
    }

    return NextResponse.json({ success: true, processed: updatedCount });

  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}