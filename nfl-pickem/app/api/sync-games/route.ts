export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface GameRecord {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  status: string;
  week: string;
  game_time: string;
}

function calculatePoints(homeScore: number, awayScore: number, homeGuess: number, awayGuess: number) {
  const realDiff = homeScore - awayScore;
  const predDiff = homeGuess - awayGuess;
  const realWinner = realDiff > 0 ? 'home' : realDiff < 0 ? 'away' : 'tie';
  const predWinner = predDiff > 0 ? 'home' : predDiff < 0 ? 'away' : 'tie';

  if (homeScore === homeGuess && awayScore === awayGuess) return 7;
  if (realWinner === predWinner && realWinner !== 'tie') {
    if (realDiff === predDiff) return 5;
    return 3;
  }
  return 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', { next: { revalidate: 0 } });
    const data = await response.json();
    const events = data.events;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ message: 'Nenhum jogo encontrado' }, { status: 200 });
    }

    let updatedCount = 0;
    let hasNewFinishedGame = false;
    
    for (const event of events) {
      const statusName = event?.status?.type?.name || '';
      const isFinished = statusName === 'STATUS_FINAL';
      const isInProgress = statusName === 'STATUS_IN_PROGRESS';
      
      const period = event?.status?.period || '';
      const displayClock = event?.status?.displayClock || '';
      const clockString = isInProgress ? `${period}Q - ${displayClock}` : (isFinished ? 'FINAL' : '');

      const competition = event?.competitions?.[0];
      if (!competition) continue;

      const homeData = competition.competitors?.find((c: any) => c.homeAway === 'home');
      const awayData = competition.competitors?.find((c: any) => c.homeAway === 'away');

      const homeAbbr = homeData?.team?.abbreviation;
      const awayAbbr = awayData?.team?.abbreviation;
      const homeScore = parseInt(homeData?.score || '0');
      const awayScore = parseInt(awayData?.score || '0');

      // --- EXTRAÇÃO DA EMISSORA (BROADCAST) ---
      const broadcastStr = competition?.broadcasts?.[0]?.names?.[0] || '';

      console.log(`\n--- Analisando: ${awayAbbr} @ ${homeAbbr} ---`);

      const homeTeamId = homeData?.team?.id;
      const awayTeamId = awayData?.team?.id;

      let homeLeaders: any[] = [];
      let awayLeaders: any[] = [];

      if (isInProgress || isFinished) {
        try {
          const summaryRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${event.id}`, { next: { revalidate: 0 } });
          
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            
            // 1. EXTRAIR LÍDERES OFENSIVOS
            if (summaryData.leaders && Array.isArray(summaryData.leaders)) {
              summaryData.leaders.forEach((teamBlock: any) => {
                const currentTeamId = teamBlock.team?.id;
                
                const parsedLeaders = (teamBlock.leaders || []).map((cat: any) => {
                  const topPlayer = cat.leaders?.[0];
                  if (!topPlayer) return null;
                  
                  const athlete = topPlayer.athlete || {};
                  let athleteName = athlete.shortName || athlete.displayName || athlete.fullName || 'N/A';
                  if (athleteName.toLowerCase() === 'total') athleteName = 'N/A';
                  if (athleteName === 'N/A') return null;

                  return {
                    category: cat.shortDisplayName || cat.displayName || cat.name || '',
                    name: athleteName,
                    stat: topPlayer.displayValue || '0'
                  };
                }).filter(Boolean);

                if (currentTeamId === homeTeamId) homeLeaders = parsedLeaders;
                else if (currentTeamId === awayTeamId) awayLeaders = parsedLeaders;
              });
            }

            // 2. EXTRAIR ESTATÍSTICAS REAIS DE DEFESA
            const getTeamStat = (teamId: string, statName: string) => {
                const teamBox = summaryData.boxscore?.teams?.find((t: any) => t.team?.id === teamId);
                return teamBox?.statistics?.find((s: any) => s.name === statName)?.displayValue || "0";
            };

            const homeSacks = parseInt(getTeamStat(awayTeamId, "sacksYardsLost").split("-")[0]) || 0;
            const homeInts = parseInt(getTeamStat(awayTeamId, "interceptions")) || 0;
            const homeFums = parseInt(getTeamStat(awayTeamId, "fumblesLost")) || 0;

            const awaySacks = parseInt(getTeamStat(homeTeamId, "sacksYardsLost").split("-")[0]) || 0;
            const awayInts = parseInt(getTeamStat(homeTeamId, "interceptions")) || 0;
            const awayFums = parseInt(getTeamStat(homeTeamId, "fumblesLost")) || 0;

            // 3. EXTRAIR ESTATÍSTICAS REAIS DE SPECIAL TEAMS
            const getKicks = (teamId: string, type: string) => {
                const players = summaryData.boxscore?.players?.find((p: any) => p.team?.id === teamId);
                if (!players) return "0/0";
                const kickStats = players.statistics?.find((s: any) => s.name === "kicking");
                if (!kickStats) return "0/0";
                const idx = kickStats.labels?.indexOf(type);
                if (idx === -1 || idx === undefined) return "0/0";
                
                let makes = 0, attempts = 0;
                kickStats.athletes?.forEach((a: any) => {
                    const val = a.stats?.[idx] || "";
                    const parts = val.split(/\/|-/);
                    if(parts.length === 2) {
                        makes += parseInt(parts[0]) || 0;
                        attempts += parseInt(parts[1]) || 0;
                    }
                });
                return `${makes}/${attempts}`;
            };

            const getPunts = (teamId: string) => {
                const players = summaryData.boxscore?.players?.find((p: any) => p.team?.id === teamId);
                if (!players) return 0;
                const puntStats = players.statistics?.find((s: any) => s.name === "punting");
                if (!puntStats) return 0;
                const idx = puntStats.labels?.indexOf("NO");
                if (idx === -1 || idx === undefined) return 0;
                return puntStats.athletes?.reduce((acc: number, a: any) => acc + (parseInt(a.stats?.[idx]) || 0), 0) || 0;
            };

            // Injetamos os cards unificados diretamente na API
            homeLeaders.push({ category: 'TEAM_DEF', name: 'Team Defense', stat: `${homeSacks} Sacks, ${homeInts} INT, ${homeFums} Fum. Rec.` });
            homeLeaders.push({ category: 'TEAM_ST', name: 'Special Teams', stat: `${getKicks(homeTeamId, "FG")} FG | ${getKicks(homeTeamId, "XP")} XP | ${getPunts(homeTeamId)} Punts` });

            awayLeaders.push({ category: 'TEAM_DEF', name: 'Team Defense', stat: `${awaySacks} Sacks, ${awayInts} INT, ${awayFums} Fum. Rec.` });
            awayLeaders.push({ category: 'TEAM_ST', name: 'Special Teams', stat: `${getKicks(awayTeamId, "FG")} FG | ${getKicks(awayTeamId, "XP")} XP | ${getPunts(awayTeamId)} Punts` });

          }
        } catch (e) {
          console.error(`Falha ao buscar summary profundo do jogo ${event.id}`, e);
        }
      }

      const metaData = {
        linescores: {
          home: homeData?.linescores?.map((l: any) => l.value) || [],
          away: awayData?.linescores?.map((l: any) => l.value) || []
        },
        leaders: { home: homeLeaders, away: awayLeaders },
        broadcast: broadcastStr
      };

      let espnWeek = event?.week?.number?.toString() || '1';
      if (event?.season?.type === 3) {
        if (espnWeek === '1') espnWeek = 'WC';
        else if (espnWeek === '2') espnWeek = 'DR';
        else if (espnWeek === '3') espnWeek = 'CC';
        else if (espnWeek === '4' || espnWeek === '5') espnWeek = 'SB'; 
      }

      if (homeAbbr && awayAbbr) {
        const { data: homeTeam } = await supabase.from('teams').select('id, name').eq('abbreviation', homeAbbr).single();
        const { data: awayTeam } = await supabase.from('teams').select('id, name').eq('abbreviation', awayAbbr).single();

        if (homeTeam && awayTeam) {
          const { data: gameCheck } = await supabase.from('games')
            .select('id, status, meta_data')
            .eq('home_team_id', homeTeam.id)
            .eq('away_team_id', awayTeam.id)
            .eq('week', espnWeek)
            .maybeSingle();
            
          if (gameCheck) {
            
            // TRAVA DE SEGURANÇA INTELIGENTE DE VOLTA!
            // Verifica se o banco já possui as estatísticas completas para não gastar fetch à toa.
            const dbMeta = gameCheck.meta_data as any;
            const hasLeaders = (dbMeta?.leaders?.home?.length > 0) || (dbMeta?.leaders?.away?.length > 0);
            
            // Só pula a atualização se o jogo já acabou E as estatísticas estão preenchidas.
            if (gameCheck.status === 'finished' && hasLeaders) {
                console.log(`[WARN] Jogo já estava FINALIZADO com estatísticas prontas. Pulando.`);
                continue;
            }

            let dbStatus = 'pending';
            if (isFinished) dbStatus = 'finished';
            else if (isInProgress) dbStatus = 'in_progress';

            if (isFinished && gameCheck.status !== 'finished') {
              hasNewFinishedGame = true;
            }

            const { error } = await supabase
              .from('games')
              .update({
                home_score: homeScore,
                away_score: awayScore,
                status: dbStatus,
                clock: clockString,
                meta_data: metaData
              })
              .eq('id', gameCheck.id);

            if (!error) updatedCount++;
          }
        }
      }
    }

    // Mesmo sem jogos finalizados hoje, chamamos a reavaliação 
    // para corrigir as vitórias/derrotas das temporadas passadas (0-124)
    await recalculateStandings(supabase);
    await recalculateLeaderboard(supabase);

    return NextResponse.json({ success: true, processed: updatedCount, message: "Sync executado com sucesso." });

  } catch (error) {
    console.error("CRITICAL SYNC ERROR:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function recalculateStandings(supabase: any) {
  const { data: teams } = await supabase.from('teams').select('id, conference, division');
  
  const { data: games } = await supabase.from('games').select('id, home_team_id, away_team_id, home_score, away_score, status, week, game_time').eq('status', 'finished') as { data: GameRecord[] | null };
  if (!teams || !games) return;

  // Filtro poderoso: Agrega somente os jogos da temporada atual
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const activeSeasonYear = currentMonth < 3 ? currentYear - 1 : currentYear;

  const uniqueGames = new Map();
  games.forEach(g => {
      if (!g.game_time) return;
      const d = new Date(g.game_time);
      const gYear = d.getFullYear();
      const sYear = d.getMonth() < 3 ? gYear - 1 : gYear;
      
      if (sYear === activeSeasonYear) {
          uniqueGames.set(g.id, g); 
      }
  });
  
  const seasonGames = Array.from(uniqueGames.values());
  const { data: existingStandings } = await supabase.from('standings').select('id, team_id');
  const standingsMap = new Map((existingStandings || []).map((s: any) => [s.team_id, s.id]));

  for (const team of teams) {
    let wins = 0, losses = 0, ties = 0, divW = 0, divL = 0, divT = 0, confW = 0, confL = 0, confT = 0, crossW = 0, crossL = 0, crossT = 0;
    
    seasonGames.forEach((game) => {
      if (['WC', 'DR', 'CC', 'SB', 'AFCC', 'NFCC'].includes(game.week)) return;
      const isHome = game.home_team_id === team.id;
      const isAway = game.away_team_id === team.id;
      if (!isHome && !isAway) return;
      
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      const opponent = teams.find((t: any) => t.id === opponentId);
      const teamScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;
      
      if (teamScore === null || oppScore === null) return;
      
      const isWin = teamScore > oppScore, isLoss = teamScore < oppScore, isTie = teamScore === oppScore;
      if (isWin) wins++; if (isLoss) losses++; if (isTie) ties++;
      
      if (opponent) {
        const sameConf = team.conference === opponent.conference, sameDiv = sameConf && team.division === opponent.division;
        if (sameDiv) { if (isWin) divW++; if (isLoss) divL++; if (isTie) divT++; }
        if (sameConf) { if (isWin) confW++; if (isLoss) confL++; if (isTie) confT++; } 
        else { if (isWin) crossW++; if (isLoss) crossL++; if (isTie) crossT++; }
      }
    });

    const recordPayload = {
      team_id: team.id, wins, losses, ties,
      division_record: `${divW}-${divL}${divT > 0 ? `-${divT}` : ''}`,
      conference_record: `${confW}-${confL}${confT > 0 ? `-${confT}` : ''}`,
      cross_conference_record: `${crossW}-${crossL}${crossT > 0 ? `-${crossT}` : ''}`,
      updated_at: new Date().toISOString()
    };
    
    const existingId = standingsMap.get(team.id);
    if (existingId) await supabase.from('standings').update(recordPayload).eq('id', existingId);
    else await supabase.from('standings').insert(recordPayload);
  }
}

async function recalculateLeaderboard(supabase: any) {
  const { data: users } = await supabase.from('profiles').select('id');
  const { data: games } = await supabase.from('games').select('id, home_score, away_score').eq('status', 'finished') as { data: GameRecord[] | null };
  const { data: guesses } = await supabase.from('guesses').select('*');
  
  if (!users || !games || !guesses) return;
  const gamesMap = new Map(games.map((g) => [g.id, g]));
  
  const updates = users.map((user: any) => {
    let totalScore = 0;
    const userGuesses = guesses.filter((g: any) => g.user_id === user.id);
    userGuesses.forEach((guess: any) => {
      const game = gamesMap.get(guess.game_id);
      if (game && game.home_score !== null && game.away_score !== null) {
        totalScore += calculatePoints(game.home_score, game.away_score, guess.home_guess, guess.away_guess);
      }
    });
    return { id: user.id, score: totalScore };
  });
  
  await supabase.from('profiles').upsert(updates);
}