export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminSession, isCronAuthorized } from '@/utils/routeAuth';

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

// GET: usado por cron/automação. Exige CRON_SECRET (header Authorization: Bearer ou ?secret= legado).
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runSync(request);
}

// POST: usado pelo painel /admin. Exige sessão de admin validada no servidor (ou CRON_SECRET).
export async function POST(request: Request) {
  if (!isCronAuthorized(request) && !(await isAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return runSync(request);
}

async function runSync(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPatch = searchParams.get('patch')?.toLowerCase() === 'true'; 
    const weekParam = searchParams.get('week');
    const seasonTypeParam = searchParams.get('seasontype') || '2';
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: dbTeams } = await supabase.from('teams').select('id, name, city, abbreviation');

    let espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
    if (weekParam) {
      espnUrl += `?week=${weekParam}&seasontype=${seasonTypeParam}`;
      console.log(`[SYNC] Buscando dados da Semana ${weekParam}...`);
    } else {
      console.log(`[SYNC] Buscando semana atual padrão...`);
    }

    const response = await fetch(espnUrl, { next: { revalidate: 0 } });
    const data = await response.json();
    const events = data.events;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ message: 'Nenhum jogo encontrado para esta chamada' }, { status: 200 });
    }

    let updatedCount = 0;

    const findTeam = (espnTeam: any) => {
      if (!espnTeam || !dbTeams) return null;
      const espnAbbr = espnTeam.abbreviation?.toUpperCase() || '';
      const espnName = espnTeam.name?.toLowerCase() || ''; 
      const espnDisplayName = espnTeam.displayName?.toLowerCase() || ''; 

      const abbrCorrectionMap: Record<string, string> = {
        'WAS': 'WSH', 'LA': 'LAR', 'LVR': 'LV', 'NEP': 'NE'
      };

      const targetAbbr = abbrCorrectionMap[espnAbbr] || espnAbbr;

      return dbTeams.find(t => {
        const dbAbbr = t.abbreviation?.toUpperCase() || '';
        const dbName = t.name?.toLowerCase() || '';
        const dbFullName = `${t.city} ${t.name}`.toLowerCase();
        return (dbAbbr === targetAbbr || dbName === espnName || dbFullName === espnDisplayName);
      });
    };

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

      const homeTeam = findTeam(homeData?.team);
      const awayTeam = findTeam(awayData?.team);

      if (!homeTeam || !awayTeam) {
        console.log(`[AVISO] Equipas não encontradas no DB: ESPN Away (${awayData?.team?.abbreviation}) @ ESPN Home (${homeData?.team?.abbreviation})`);
        continue;
      }

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

      console.log(`--- Sincronizando: ${awayTeam.abbreviation} @ ${homeTeam.abbreviation} ---`);

      let homeLeaders: any[] = [];
      let awayLeaders: any[] = [];
      let rawBoxscore: any = null;
      let rawCompetition: any = null;

      if (isInProgress || isFinished || isPatch) {
        try {
          const summaryRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${event.id}`, { next: { revalidate: 0 } });
          
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            rawBoxscore = summaryData.boxscore; 
            rawCompetition = competition;
            
            const extractFullRoster = (espnTeamId: string) => {
                const playersData = summaryData.boxscore?.players?.find((p: any) => p.team?.id === espnTeamId);
                if (!playersData || !playersData.statistics) return [];

                const passers: any[] = [];
                const rushers: any[] = [];
                const receivers: any[] = [];
                const defenders: any[] = [];

                playersData.statistics.forEach((statBlock: any) => {
                    const catName = statBlock.name;
                    const labels = statBlock.labels || [];

                    if (catName === 'passing') {
                        const cAttIdx = labels.indexOf('C/ATT');
                        const ydsIdx = labels.indexOf('YDS');
                        const tdIdx = labels.indexOf('TD');
                        const intIdx = labels.indexOf('INT');
                        statBlock.athletes?.forEach((a: any) => {
                            const cAtt = a.stats?.[cAttIdx] || '0/0';
                            const yds = parseFloat(a.stats?.[ydsIdx]) || 0;
                            const td = parseFloat(a.stats?.[tdIdx]) || 0;
                            const int = parseFloat(a.stats?.[intIdx]) || 0;
                            const name = a.athlete?.shortName || a.athlete?.displayName || 'N/A';
                            if (yds !== 0 || td !== 0 || int !== 0) {
                                passers.push({ category: 'PASSING', name, stat: `${cAtt}, ${yds} YDS, ${td} TD, ${int} INT`, sortYds: yds });
                            }
                        });
                    } else if (catName === 'rushing') {
                        const carIdx = labels.indexOf('CAR');
                        const ydsIdx = labels.indexOf('YDS');
                        const tdIdx = labels.indexOf('TD');
                        statBlock.athletes?.forEach((a: any) => {
                            const car = a.stats?.[carIdx] || '0';
                            const yds = parseFloat(a.stats?.[ydsIdx]) || 0;
                            const td = parseFloat(a.stats?.[tdIdx]) || 0;
                            const name = a.athlete?.shortName || a.athlete?.displayName || 'N/A';
                            if (yds !== 0 || td !== 0) {
                                rushers.push({ category: 'RUSHING', name, stat: `${car} CAR, ${yds} YDS, ${td} TD`, sortYds: yds });
                            }
                        });
                    } else if (catName === 'receiving') {
                        const recIdx = labels.indexOf('REC');
                        const ydsIdx = labels.indexOf('YDS');
                        const tdIdx = labels.indexOf('TD');
                        statBlock.athletes?.forEach((a: any) => {
                            const rec = a.stats?.[recIdx] || '0';
                            const yds = parseFloat(a.stats?.[ydsIdx]) || 0;
                            const td = parseFloat(a.stats?.[tdIdx]) || 0;
                            const name = a.athlete?.shortName || a.athlete?.displayName || 'N/A';
                            if (yds !== 0 || td !== 0) {
                                receivers.push({ category: 'RECEIVING', name, stat: `${rec} REC, ${yds} YDS, ${td} TD`, sortYds: yds });
                            }
                        });
                    } else if (catName === 'defensive') {
                        const sackIdx = labels.indexOf('SACKS');
                        const intIdx = labels.indexOf('INT');
                        statBlock.athletes?.forEach((a: any) => {
                            const sacks = parseFloat(a.stats?.[sackIdx]) || 0;
                            const ints = parseFloat(a.stats?.[intIdx]) || 0;
                            const name = a.athlete?.shortName || a.athlete?.displayName || 'N/A';
                            if (sacks > 0) defenders.push({ category: 'SACKS', name, stat: sacks.toString() });
                            if (ints > 0) defenders.push({ category: 'INTERCEPTIONS', name, stat: ints.toString() });
                        });
                    }
                });

                passers.sort((a, b) => b.sortYds - a.sortYds);
                rushers.sort((a, b) => b.sortYds - a.sortYds);
                receivers.sort((a, b) => b.sortYds - a.sortYds);

                const finalList: any[] = [];
                if (passers.length > 0) finalList.push(passers.shift());
                if (rushers.length > 0) finalList.push(rushers.shift());
                if (receivers.length > 0) finalList.push(receivers.shift());

                finalList.push(...passers, ...rushers, ...receivers, ...defenders);
                return finalList.map(({ sortYds, ...rest }) => rest);
            };

            homeLeaders = extractFullRoster(homeData?.team?.id);
            awayLeaders = extractFullRoster(awayData?.team?.id);

            const getTeamStat = (espnTeamId: string, statName: string) => {
                const teamBox = summaryData.boxscore?.teams?.find((t: any) => t.team?.id === espnTeamId);
                return teamBox?.statistics?.find((s: any) => s.name === statName)?.displayValue || "0";
            };

            const homeSacks = parseInt(getTeamStat(awayData?.team?.id, "sacksYardsLost").split("-")[0]) || 0;
            const homeInts = parseInt(getTeamStat(awayData?.team?.id, "interceptions")) || 0;
            const homeFums = parseInt(getTeamStat(awayData?.team?.id, "fumblesLost")) || 0;

            const awaySacks = parseInt(getTeamStat(homeData?.team?.id, "sacksYardsLost").split("-")[0]) || 0;
            const awayInts = parseInt(getTeamStat(homeData?.team?.id, "interceptions")) || 0;
            const awayFums = parseInt(getTeamStat(homeData?.team?.id, "fumblesLost")) || 0;

            const getKicks = (espnTeamId: string, type: string) => {
                const players = summaryData.boxscore?.players?.find((p: any) => p.team?.id === espnTeamId);
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

            const getPunts = (espnTeamId: string) => {
                const players = summaryData.boxscore?.players?.find((p: any) => p.team?.id === espnTeamId);
                if (!players) return 0;
                const puntStats = players.statistics?.find((s: any) => s.name === "punting");
                if (!puntStats) return 0;
                const idx = puntStats.labels?.indexOf("NO");
                if (idx === -1 || idx === undefined) return 0;
                return puntStats.athletes?.reduce((acc: number, a: any) => acc + (parseInt(a.stats?.[idx]) || 0), 0) || 0;
            };

            homeLeaders.push({ category: 'TEAM_DEF', name: 'Team Defense', stat: `${homeSacks} Sacks, ${homeInts} INT, ${homeFums} Fum. Rec.` });
            homeLeaders.push({ category: 'TEAM_ST', name: 'Special Teams', stat: `${getKicks(homeData?.team?.id, "FG")} FG | ${getKicks(homeData?.team?.id, "XP")} XP | ${getPunts(homeData?.team?.id)} Punts` });

            awayLeaders.push({ category: 'TEAM_DEF', name: 'Team Defense', stat: `${awaySacks} Sacks, ${awayInts} INT, ${awayFums} Fum. Rec.` });
            awayLeaders.push({ category: 'TEAM_ST', name: 'Special Teams', stat: `${getKicks(awayData?.team?.id, "FG")} FG | ${getKicks(awayData?.team?.id, "XP")} XP | ${getPunts(awayData?.team?.id)} Punts` });

          }
        } catch (e) {
          console.error(`Falha ao buscar summary profundo do jogo ${event.id}`, e);
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
          console.log(`[PATCH] Injetando novos stats: ${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`);
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

    return NextResponse.json({ success: true, processed: updatedCount, message: `Sync concluído. Modo Patch: ${isPatch}` });

  } catch (error) {
    console.error("CRITICAL SYNC ERROR:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function recalculateStandings(supabase: any) {
  const { data: teams } = await supabase.from('teams').select('id, conference, division');
  const { data: games } = await supabase.from('games').select('id, home_team_id, away_team_id, home_score, away_score, status, week, game_time').eq('status', 'finished') as { data: GameRecord[] | null };
  if (!teams || !games) return;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const activeSeasonYear = currentMonth < 3 ? currentYear - 1 : currentYear;

  const uniqueGames = new Map();
  games.forEach(g => {
      if (!g.game_time) return;
      const d = new Date(g.game_time);
      const gYear = d.getFullYear();
      const sYear = d.getMonth() < 3 ? gYear - 1 : gYear;
      if (sYear === activeSeasonYear) uniqueGames.set(g.id, g); 
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