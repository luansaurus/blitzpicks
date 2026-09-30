import { SupabaseClient } from '@supabase/supabase-js';
import { calculatePoints } from '@/lib/scoring';
import { isPlayoffWeek } from '@/lib/constants/playoffs';

export async function recalculateStandings(supabase: SupabaseClient) {
  const { data: teams, error: teamsErr } = await supabase.from('teams').select('id, conference, division');
  const { data: games, error: gamesErr } = await supabase.from('games').select('home_team_id, away_team_id, home_score, away_score, status, week').eq('status', 'finished');
  if (teamsErr || gamesErr) throw new Error(`recalculateStandings: ${(teamsErr || gamesErr)!.message}`);

  if (!teams || !games) return;

  const { data: existingStandings, error: standErr } = await supabase.from('standings').select('id, team_id');
  if (standErr) throw new Error(`recalculateStandings: ${standErr.message}`);
  const standingsMap = new Map((existingStandings || []).map((s: any) => [s.team_id, s.id]));

  // CORREÇÃO: Separamos em duas listas para o Supabase não injetar 'null' nos IDs em massa
  const inserts: any[] = [];
  const updates: any[] = [];

  teams.forEach((team) => {
    let wins = 0, losses = 0, ties = 0;
    let divW = 0, divL = 0, divT = 0;
    let confW = 0, confL = 0, confT = 0;
    let crossW = 0, crossL = 0, crossT = 0;

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

    const recordPayload: any = {
      team_id: team.id, 
      division: team.division || 'Unknown',
      wins, 
      losses, 
      ties,
      division_record: `${divW}-${divL}${divT > 0 ? `-${divT}` : ''}`,
      conference_record: `${confW}-${confL}${confT > 0 ? `-${confT}` : ''}`,
      cross_conference_record: `${crossW}-${crossL}${crossT > 0 ? `-${crossT}` : ''}`,
      updated_at: new Date().toISOString()
    };

    const existingId = standingsMap.get(team.id);
    if (existingId) {
      recordPayload.id = existingId;
      updates.push(recordPayload);
    } else {
      inserts.push(recordPayload);
    }
  });

  if (updates.length > 0) {
    const { error } = await supabase.from('standings').upsert(updates);
    if (error) throw new Error(`recalculateStandings update: ${error.message}`);
  }
  
  if (inserts.length > 0) {
    const { error } = await supabase.from('standings').insert(inserts);
    if (error) throw new Error(`recalculateStandings insert: ${error.message}`);
  }
}

export async function recalculateLeaderboard(supabase: SupabaseClient) {
  const { data: users, error: usersErr } = await supabase.from('profiles').select('id');
  const { data: games, error: gamesErr } = await supabase.from('games').select('id, home_score, away_score').eq('status', 'finished');
  const { data: guesses, error: guessesErr } = await supabase.from('guesses').select('*');
  const firstErr = usersErr || gamesErr || guessesErr;
  if (firstErr) throw new Error(`recalculateLeaderboard: ${firstErr.message}`);

  if (!users || !games || !guesses) return;

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

  if (updates.length > 0) {
    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) throw new Error(`recalculateLeaderboard upsert: ${error.message}`);
  }
}