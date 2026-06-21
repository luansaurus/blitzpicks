"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import UserTeamHero from '../../components/dashboard/UserTeamHero';
import GameCard from '../../components/scoreboard/GameCard';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function Dashboard() {
  const [games, setGames] = useState<any[]>([]);
  const [teamsDataMap, setTeamsDataMap] = useState<Record<string, any>>({});
  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  
  const [draftPicks, setDraftPicks] = useState<Record<string, { home: number, away: number }>>({});
  const [isSavingPicks, setIsSavingPicks] = useState(false);

  const [userScore, setUserScore] = useState(0);
  const [favoriteTeamId, setFavoriteTeamId] = useState<number | string>('');
  const [userColor, setUserColor] = useState('#E31837');
  
  const [currentWeek, setCurrentWeek] = useState<string>('1');
  const [loading, setLoading] = useState(true);

  const [lastGame, setLastGame] = useState<any>(null);
  const [nextGame, setNextGame] = useState<any>(null);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadDashboardData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: profile } = await supabase.from('profiles').select('nickname, score, favorite_team_id').eq('id', session.user.id).single();
      if (!profile?.nickname) { router.push('/setup'); return; }

      setUserScore(profile.score || 0);
      let fTeamId = profile.favorite_team_id;
      if (fTeamId) setFavoriteTeamId(fTeamId);

      const { data: teams } = await supabase.from('teams').select('*');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { tMap[t.id.toString()] = { name: t.name, abbr: t.abbreviation, color: t.primary_color, logo: t.logo_url }; });
      setTeamsDataMap(tMap);

      if (typeof window !== "undefined") {
         const savedAccent = localStorage.getItem('blitz_accent');
         if (savedAccent) setUserColor(savedAccent);
      }

      const { data: gamesData } = await supabase.from('games').select('*, stadium(name, city)').order('game_time', { ascending: true });
      if (gamesData && gamesData.length > 0) {
        setGames(gamesData);
        
        if (fTeamId) {
          const teamGames = gamesData.filter(g => g.home_team_id?.toString() === fTeamId?.toString() || g.away_team_id?.toString() === fTeamId?.toString());
          
          const finished = teamGames.filter(g => g.status === 'finished').sort((a, b) => new Date(b.game_time).getTime() - new Date(a.game_time).getTime());
          const pending = teamGames.filter(g => g.status !== 'finished').sort((a, b) => new Date(a.game_time).getTime() - new Date(b.game_time).getTime());
          
          setLastGame(finished[0] || null);
          setNextGame(pending[0] || null);
        }

        const grouped = gamesData.reduce((acc, g) => {
          const w = g.week || '1';
          if (!acc[w]) acc[w] = [];
          acc[w].push(g);
          return acc;
        }, {} as Record<string, any[]>);

        const sortedWeeks = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
        const activeWeek = sortedWeeks.find(w => !grouped[w].every((game: any) => game.status === 'finished')) || sortedWeeks[sortedWeeks.length - 1];
        setCurrentWeek(activeWeek);
      }

      const { data: guessesData } = await supabase.from('guesses').select('*').eq('user_id', session.user.id);
      if (guessesData) setMyGuesses(guessesData);

      setLoading(false);
    }
    loadDashboardData();
  }, [router, supabase]);

  const handlePickChange = (gameId: string | number, homeStr: string, awayStr: string) => {
    const gId = gameId.toString();
    if (homeStr === "" && awayStr === "") {
      setDraftPicks(prev => { const next = { ...prev }; delete next[gId]; return next; });
      return;
    }
    const home = homeStr === "" ? 0 : parseInt(homeStr);
    const away = awayStr === "" ? 0 : parseInt(awayStr);
    const existing = myGuesses.find(g => g.game_id.toString() === gId);
    if (existing && existing.home_guess === home && existing.away_guess === away) {
      setDraftPicks(prev => { const next = { ...prev }; delete next[gId]; return next; });
      return;
    }
    setDraftPicks(prev => ({ ...prev, [gId]: { home, away } }));
  };

  const handleSaveAll = async () => {
    setIsSavingPicks(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const payload = Object.entries(draftPicks).map(([gameId, scores]) => ({
      id: parseInt(gameId),
      user_id: session.user.id,
      game_id: parseInt(gameId),
      home_guess: scores.home,
      away_guess: scores.away
    }));

    const { error } = await supabase.from('guesses').upsert(payload, { onConflict: 'user_id,game_id' });
    
    if (!error) {
      const { data: newGuesses } = await supabase.from('guesses').select('*').eq('user_id', session.user.id);
      if (newGuesses) setMyGuesses(newGuesses);
      setDraftPicks({});
    } else {
      alert("Erro ao salvar palpites.");
    }
    setIsSavingPicks(false);
  };

  if (loading) return <LoadingScreen />;

  const currentWeekGames = games.filter(game => game.week?.toString() === currentWeek.toString());

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32 relative">
      <Header />
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8 mt-4">
        <UserTeamHero 
          teamId={favoriteTeamId} 
          score={userScore} 
          lastGame={lastGame} 
          nextGame={nextGame} 
          teamsDataMap={teamsDataMap} 
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-wider">Week {currentWeek}</h2>
              <p className="text-gray-500 text-xs font-medium mt-0.5 hidden sm:block">Current active week board inside your locker room.</p>
            </div>
            <button 
              onClick={() => router.push('/schedule')}
              className="text-[10px] sm:text-xs font-bold uppercase tracking-widest px-3 sm:px-4 py-2 rounded-lg transition-all"
              style={{ backgroundColor: `${userColor}20`, color: userColor, border: `1px solid ${userColor}40`, textShadow: `0 0 10px ${userColor}80` }}
            >
              Other Picks ➔
            </button>
          </div>

          {currentWeekGames.length === 0 ? (
            <div className="bg-neutral-900 border border-white/5 rounded-xl p-8 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
              No matchups scheduled for this week.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {currentWeekGames.map((game) => {
                const existingPick = myGuesses.find(g => g.game_id?.toString() === game.id?.toString());
                const isUnsaved = !!draftPicks[game.id.toString()];

                return (
                  <GameCard 
                    key={game.id} 
                    game={game} 
                    userTeamColor={userColor} 
                    homeTeam={teamsDataMap[game.home_team_id?.toString()] || { name: 'Home', abbr: 'HOME', color: '#171717' }}
                    awayTeam={teamsDataMap[game.away_team_id?.toString()] || { name: 'Away', abbr: 'AWAY', color: '#171717' }}
                    existingPick={existingPick}
                    onPickChange={handlePickChange}
                    isUnsaved={isUnsaved}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {Object.keys(draftPicks).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md animate-slideUp">
          <div className="bg-neutral-900 border-2 rounded-2xl p-4 flex items-center justify-between gap-4" style={{ borderColor: userColor, boxShadow: `0 10px 40px ${userColor}50` }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: userColor, textShadow: `0 0 10px ${userColor}80` }}>Unsaved Changes</span>
              <span className="text-sm font-bold text-white">{Object.keys(draftPicks).length} Pick(s) pending</span>
            </div>
            <button onClick={handleSaveAll} disabled={isSavingPicks} className="px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-md disabled:opacity-50 text-xs sm:text-sm" style={{ backgroundColor: userColor, color: '#000' }}>
              {isSavingPicks ? 'Locking...' : 'Lock All'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}