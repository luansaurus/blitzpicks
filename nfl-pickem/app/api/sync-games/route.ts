export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

interface GameRecord {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  status: string;
  week: string;
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

    const USE_MOCK = process.env.USE_MOCK_DATA === 'true';
    let events = [];

    if (USE_MOCK) {
      const mockPath = path.join(process.cwd(), 'mocks', 'espn_week1.json');
      const mockData = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
      events = mockData.events;
    } else {
      const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', { next: { revalidate: 0 } });
      const data = await response.json();
      events = data.events;
    }

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

      console.log(`\n--- Analisando: ${awayAbbr} @ ${homeAbbr} ---`);

      const extractLeaders = (data: any) => {
        if (!data?.leaders) return [];
        return data.leaders.map((l: any) => ({
          category: l.shortDisplayName,
          name: l.leaders?.[0]?.athlete?.shortName || 'N/A',
          stat: l.leaders?.[0]?.displayValue || '0'
        }));
      };

      const metaData = {
        linescores: {
          home: homeData?.linescores?.map((l: any) => l.value) || [],
          away: awayData?.linescores?.map((l: any) => l.value) || []
        },
        leaders: {
          home: extractLeaders(homeData),
          away: extractLeaders(awayData)
        }
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
            .select('id, status')
            .eq('home_team_id', homeTeam.id)
            .eq('away_team_id', awayTeam.id)
            .eq('week', espnWeek)
            .maybeSingle();
            
          if (gameCheck) {
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

            // LOGS DETETIVES AQUI:
            if (error) {
              console.error(`❌ Erro do Supabase ao atualizar ${awayAbbr} @ ${homeAbbr}:`, error.message);
            } else {
              console.log(`✅ Sucesso! Placar: ${awayScore} - ${homeScore} | Status: ${dbStatus}`);
              updatedCount++;
            }
          } else {
            console.log(`⚠️ Jogo não encontrado no banco na semana ${espnWeek}.`);
          }
        }
      }
    }

    if (hasNewFinishedGame) {
      console.log(`\n🔄 Jogo recém-finalizado! Recalculando...`);
      await recalculateStandings(supabase);
      await recalculateLeaderboard(supabase);
    }

    return NextResponse.json({ 
      success: true, 
      processed: updatedCount,
      recalculated: hasNewFinishedGame,
      source: USE_MOCK ? 'Mock Local' : 'ESPN API'
    });

  } catch (error) {
    console.error("CRITICAL SYNC ERROR:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function recalculateStandings(supabase: any) {
  // ... (mesmo código de antes, não mudou nada aqui)
  const { data: teams } = await supabase.from('teams').select('id, conference, division');
  const { data: games } = await supabase.from('games')
    .select('home_team_id, away_team_id, home_score, away_score, status, week')
    .eq('status', 'finished') as { data: GameRecord[] | null };

  if (!teams || !games) return;

  const { data: existingStandings } = await supabase.from('standings').select('id, team_id');
  const standingsMap = new Map((existingStandings || []).map((s: any) => [s.team_id, s.id]));

  for (const team of teams) {
    let wins = 0, losses = 0, ties = 0;
    let divW = 0, divL = 0, divT = 0;
    let confW = 0, confL = 0, confT = 0;
    let crossW = 0, crossL = 0, crossT = 0;

    games.forEach((game) => {
      if (['WC', 'DR', 'CC', 'SB', 'AFCC', 'NFCC'].includes(game.week)) return;

      const isHome = game.home_team_id === team.id;
      const isAway = game.away_team_id === team.id;
      if (!isHome && !isAway) return;

      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      const opponent = teams.find((t: any) => t.id === opponentId);
      
      const teamScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;

      if (teamScore === null || oppScore === null) return;

      const isWin = teamScore > oppScore;
      const isLoss = teamScore < oppScore;
      const isTie = teamScore === oppScore;

      if (isWin) wins++; if (isLoss) losses++; if (isTie) ties++;

      if (opponent) {
        const sameConf = team.conference === opponent.conference;
        const sameDiv = sameConf && team.division === opponent.division;

        if (sameDiv) { if (isWin) divW++; if (isLoss) divL++; if (isTie) divT++; }
        if (sameConf) { if (isWin) confW++; if (isLoss) confL++; if (isTie) confT++; } 
        else { if (isWin) crossW++; if (isLoss) crossL++; if (isTie) crossT++; }
      }
    });

    const recordPayload = {
      team_id: team.id,
      wins, losses, ties,
      division_record: `${divW}-${divL}${divT > 0 ? `-${divT}` : ''}`,
      conference_record: `${confW}-${confL}${confT > 0 ? `-${confT}` : ''}`,
      cross_conference_record: `${crossW}-${crossL}${crossT > 0 ? `-${crossT}` : ''}`,
      updated_at: new Date().toISOString()
    };

    const existingId = standingsMap.get(team.id);
    if (existingId) {
      await supabase.from('standings').update(recordPayload).eq('id', existingId);
    } else {
      await supabase.from('standings').insert(recordPayload);
    }
  }
}

async function recalculateLeaderboard(supabase: any) {
  // ... (mesmo código de antes)
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