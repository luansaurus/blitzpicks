export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/server';
import { calculatePoints } from '@/lib/scoring';
import { isPlayoffWeek } from '@/lib/constants/playoffs';

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

    const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: teams } = await supabase.from('teams').select('id, conference, division');
    const { data: games } = await supabase.from('games').select('home_team_id, away_team_id, home_score, away_score, status, week').eq('status', 'finished');

    if (teams && games) {
      const { data: existingStandings } = await supabase.from('standings').select('id, team_id');
      const standingsMap = new Map((existingStandings || []).map((s: any) => [s.team_id, s.id]));

      for (const team of teams) {
        let wins = 0, losses = 0, ties = 0, divW = 0, divL = 0, divT = 0, confW = 0, confL = 0, confT = 0, crossW = 0, crossL = 0, crossT = 0;

        games.forEach((game: any) => {
          if (isPlayoffWeek(game.week)) return;

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
            const sameConf = team.conference === opponent.conference;
            const sameDiv = sameConf && team.division === opponent.division;
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

    const { data: users } = await supabase.from('profiles').select('id');
    const { data: guesses } = await supabase.from('guesses').select('*');

    if (users && games && guesses) {
      const gamesMap = new Map(games.map((g: any) => [g.id, g]));
      const updates = users.map((user: any) => {
        let totalScore = 0;
        guesses.filter((g: any) => g.user_id === user.id).forEach((guess: any) => {
          const game = gamesMap.get(guess.game_id);
          if (game && game.home_score !== null && game.away_score !== null) {
            totalScore += calculatePoints(game.home_score, game.away_score, guess.home_guess, guess.away_guess);
          }
        });
        return { id: user.id, score: totalScore };
      });
      await supabase.from('profiles').upsert(updates);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}