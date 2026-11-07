import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTeams, getGames } from '@/lib/data/queries';
import { getBestColor, getSafeColor } from '@/lib/color';
import { PLAYOFF_ORDER } from '@/lib/constants/playoffs';
import PicksClient from '@/components/picks/PicksClient';

export default async function PicksPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Busca times e jogos usando as queries centralizadas
  const [teams, games, { data: profile }] = await Promise.all([
    getTeams(supabase),
    getGames(supabase),
    supabase.from('profiles').select('favorite_team_id').eq('id', session.user.id).single()
  ]);

  // Busca apenas os palpites deste usuário para a tela de Picks
  const { data: userGuesses } = await supabase
    .from('guesses')
    .select('*')
    .eq('user_id', session.user.id);

  const teamsMap: Record<string, any> = {};
  teams.forEach(t => {
    teamsMap[t.id.toString()] = {
      id: t.id,
      name: t.name,
      abbr: t.abbreviation,
      logo: t.logo_url,
      color: getBestColor(t.primary_color || '', t.secondary_color || '')
    };
  });

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
  
  // Define a semana ativa baseada nos jogos que ainda não terminaram
  const currentActiveWeek = sortedWeeks.find(week => !gamesByWeek[week].every((g: any) => g.status === 'finished')) || sortedWeeks[sortedWeeks.length - 1] || null;

  let initialColor = '#E31837';
  let initialBg = '#0a0a0a';
  let initialSec = '#ff2a2a';

  if (profile?.favorite_team_id) {
    const t = teams.find(t => t.id === profile.favorite_team_id);
    if (t) {
      initialColor = getSafeColor(t.primary_color || '');
      initialBg = t.primary_color || '#0a0a0a';
      initialSec = t.secondary_color || '#ff2a2a';
    }
  }

  return (
    <PicksClient 
      currentUserId={session.user.id}
      initialColor={initialColor}
      initialBg={initialBg}
      initialSec={initialSec}
      teamsMap={teamsMap}
      gamesByWeek={gamesByWeek}
      myGuesses={userGuesses || []}
      regularWeeks={regularWeeks}
      playoffWeeks={playoffWeeks}
      currentActiveWeek={currentActiveWeek}
    />
  );
}
