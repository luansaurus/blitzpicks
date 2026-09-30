import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTeams, getValidProfiles, getGames, getGuesses } from '@/lib/data/queries';
import { getBestColor, getSafeColor } from '@/lib/color';
import { getPickResult } from '@/lib/scoring';
import { PLAYOFF_ORDER } from '@/lib/constants/playoffs';
import RankingClient from '@/components/ranking/RankingClient';

export default async function RankingPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const [teams, profiles, games, allGuesses] = await Promise.all([
    getTeams(supabase),
    getValidProfiles(supabase),
    getGames(supabase),
    getGuesses(supabase)
  ]);

  // 1. Mapeamento de Times
  const teamsMap: Record<string, any> = {};
  teams.forEach(t => {
    teamsMap[t.id.toString()] = {
      name: t.name,
      abbr: t.abbreviation,
      logo: t.logo_url,
      color: getBestColor(t.primary_color || '', t.secondary_color || '')
    };
  });

  // 2. Mapeamento de Usuários
  const usersMap: Record<string, any> = {};
  profiles.forEach(u => {
    usersMap[u.id] = {
      nickname: u.nickname,
      logoUrl: Array.isArray(u.teams) ? u.teams[0]?.logo_url : (u.teams as any)?.logo_url || null
    };
  });

  // 3. Mapeamento de Palpites por Jogo
  const guessesByGame: Record<string, any[]> = {};
  allGuesses.forEach(g => {
    if (!guessesByGame[g.game_id]) guessesByGame[g.game_id] = [];
    guessesByGame[g.game_id].push(g);
  });

  // 4. Mapeamento de Jogos por Semana
  const gamesByWeek: Record<string, any[]> = {};
  games.forEach(g => {
    let w = g.week || '1';
    if (w === 'AFCC' || w === 'NFCC') w = 'CC';
    if (!gamesByWeek[w]) gamesByWeek[w] = [];
    gamesByWeek[w].push(g);
  });

  const allWeeks = Object.keys(gamesByWeek);
  const regularWeeks = allWeeks.filter(w => !isNaN(Number(w))).sort((a, b) => Number(a) - Number(b));
  const playoffWeeks = allWeeks.filter(w => isNaN(Number(w))).sort((a, b) => PLAYOFF_ORDER.indexOf(a) - PLAYOFF_ORDER.indexOf(b));

  const sortedWeeks = [...regularWeeks, ...playoffWeeks];
  const currentActiveWeek = sortedWeeks.find(week => !gamesByWeek[week].every((g: any) => g.status === 'finished')) || sortedWeeks[sortedWeeks.length - 1] || null;

  // 5. Cálculo do Leaderboard no Servidor
  const liveLeaderboard = profiles.map(user => {
    let officialScore = 0;
    let projectedPoints = 0;
    let exactHits = 0;
    let diffHits = 0;

    const userGuesses = allGuesses.filter(g => g.user_id === user.id);
    userGuesses.forEach(pick => {
      const game = games.find(g => g.id === pick.game_id);
      if (game && (game.status === 'finished' || game.status === 'in_progress')) {
        const res = getPickResult(game, pick, { exact: 7, diff: 5, winner: 3 });
        
        if (game.status === 'finished') {
          officialScore += res.points;
        } else if (game.status === 'in_progress') {
          projectedPoints += res.points;
        }

        if (res.points === 7) exactHits++;
        else if (res.points === 5) diffHits++;
      }
    });

    return {
      id: user.id,
      nickname: user.nickname,
      teams: user.teams,
      global_titles: user.global_titles || 0,
      officialScore,
      projectedPoints,
      totalScore: officialScore + projectedPoints,
      exactHits,
      diffHits
    };
  });

  // Ordenação com Desempate
  liveLeaderboard.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
    if (b.diffHits !== a.diffHits) return b.diffHits - a.diffHits;
    if (b.global_titles !== a.global_titles) return b.global_titles - a.global_titles;
    return (a.nickname || '').localeCompare(b.nickname || '');
  });

  // Atribuição de Ranks
  for (let i = 0; i < liveLeaderboard.length; i++) {
    if (i > 0) {
      const prev = liveLeaderboard[i - 1] as any;
      const curr = liveLeaderboard[i] as any;
      if (
        curr.totalScore === prev.totalScore &&
        curr.exactHits === prev.exactHits &&
        curr.diffHits === prev.diffHits &&
        curr.global_titles === prev.global_titles
      ) {
        curr.displayRank = prev.displayRank;
      } else {
        curr.displayRank = i + 1;
      }
    } else {
      (liveLeaderboard[i] as any).displayRank = 1;
    }
  }

  // 6. Tema e Cores (Alinhado 100% com o Client para evitar Flashes)
  let initialColor = '#E31837';
  let initialBg = '#0a0a0a';
  let initialSec = '#ff2a2a';
  const myProfile = profiles.find(p => p.id === session.user.id);
  
  if (myProfile?.favorite_team_id) {
    const t = teams.find(t => t.id === myProfile.favorite_team_id);
    if (t) {
      initialColor = getSafeColor(t.primary_color || '');
      initialBg = t.primary_color || '#0a0a0a';
      initialSec = t.secondary_color || '#ff2a2a';
    }
  }

  const myUserGuesses = allGuesses.filter(g => g.user_id === session.user.id);

  return (
    <RankingClient 
      currentUserId={session.user.id}
      initialColor={initialColor}
      initialBg={initialBg}
      initialSec={initialSec}
      teamsMap={teamsMap}
      usersMap={usersMap}
      gamesByWeek={gamesByWeek}
      guessesByGame={guessesByGame}
      myGuesses={myUserGuesses}
      leaderboard={liveLeaderboard}
      regularWeeks={regularWeeks}
      playoffWeeks={playoffWeeks}
      currentActiveWeek={currentActiveWeek}
    />
  );
}