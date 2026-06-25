"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import UserTeamHero from '../../components/dashboard/UserTeamHero';
import GameCard from '../../components/scoreboard/GameCard';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import LeagueHub from '../../components/leagues/LeagueHub';
import { getPickResult } from '@/utils/scoring';

export default function Dashboard() {
  const [games, setGames] = useState<any[]>([]);
  const [teamsDataMap, setTeamsDataMap] = useState<Record<string, any>>({});
  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  
  const [draftPicks, setDraftPicks] = useState<Record<string, { home: number, away: number }>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  const [favoriteTeamId, setFavoriteTeamId] = useState<number | string>('');
  const [userColor, setUserColor] = useState('#E31837');
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState<'locker' | 'leagues'>('locker');

  const [currentWeek, setCurrentWeek] = useState<string>('1');
  const [loading, setLoading] = useState(true);

  const [lastGame, setLastGame] = useState<any>(null);
  const [nextGame, setNextGame] = useState<any>(null);
  
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [contextLeagueId, setContextLeagueId] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function loadDashboardData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setCurrentUserId(session.user.id);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (!profile?.nickname) { router.push('/setup'); return; }

      setIsAdmin(profile.is_admin);
      setIsVip(profile.is_vip);
      if (profile.favorite_team_id) setFavoriteTeamId(profile.favorite_team_id);

      const { data: teams } = await supabase.from('teams').select('*');
      const { data: standings } = await supabase.from('standings').select('*');
      
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { 
        const record = standings?.find(s => s.team_id?.toString() === t.id.toString());
        tMap[t.id.toString()] = { 
          name: t.name, abbr: t.abbreviation, color: t.primary_color, logo: t.logo_url,
          record: record ? `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''}` : '0-0' 
        }; 
      });
      setTeamsDataMap(tMap);

      if (typeof window !== "undefined") {
         const savedAccent = localStorage.getItem('blitz_accent');
         if (savedAccent) setUserColor(savedAccent);
      }

      const { data: gamesData } = await supabase.from('games').select('*, stadium(name, city)').order('game_time', { ascending: true });

      if (gamesData && gamesData.length > 0) {
        setGames(gamesData);
        if (profile.favorite_team_id) {
          const teamGames = gamesData.filter(g => g.home_team_id?.toString() === profile.favorite_team_id?.toString() || g.away_team_id?.toString() === profile.favorite_team_id?.toString());
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

      const { data: memberships } = await supabase.from('league_members').select('league_id, leagues(*)').eq('user_id', session.user.id);
      if (memberships) {
        const leaguesData = memberships.map((m: any) => Array.isArray(m.leagues) ? m.leagues[0] : m.leagues).filter(Boolean);
        setMyLeagues(leaguesData);
      }

      setLoading(false);
    }
    loadDashboardData();
  }, [router]);

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
    setSaveStatus('saving');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const payload = Object.entries(draftPicks).map(([gameId, scores]) => ({
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
      setSaveStatus('idle');
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const activeContextLeague = myLeagues.find(l => l.id === contextLeagueId);
  const currentRules = activeContextLeague ? { 
    exact: activeContextLeague.pts_exact, 
    diff: activeContextLeague.pts_diff, 
    winner: activeContextLeague.pts_winner 
  } : undefined;

  // CÁLCULO DINÂMICO DOS PONTOS DO USUÁRIO BASEADO NA LIGA ATUAL
  const dynamicScore = useMemo(() => {
    if (!games.length || !myGuesses.length) return 0;
    let total = 0;
    const rulesToUse = currentRules || { exact: 7, diff: 5, winner: 3 };

    myGuesses.forEach(guess => {
      const game = games.find(g => g.id.toString() === guess.game_id.toString());
      if (game && (game.status === 'finished' || game.status === 'in_progress')) {
        total += getPickResult(game, guess, rulesToUse).points;
      }
    });

    return total;
  }, [games, myGuesses, currentRules]);

  if (loading) return <LoadingScreen />;

  const currentWeekGames = games.filter(game => game.week?.toString() === currentWeek.toString());

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32 relative">
      <Header />
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8 mt-4">
        <div className="flex bg-neutral-900 border border-white/10 rounded-xl p-1 w-full max-w-sm mx-auto shadow-lg">
          <button onClick={() => setActiveDashboardTab('locker')} className={`flex-1 px-4 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeDashboardTab === 'locker' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`} style={activeDashboardTab === 'locker' ? { color: userColor } : {}}>🏈 My Locker</button>
          <button onClick={() => setActiveDashboardTab('leagues')} className={`flex-1 px-4 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeDashboardTab === 'leagues' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`} style={activeDashboardTab === 'leagues' ? { color: userColor } : {}}>🛡️ Leagues</button>
        </div>

        {activeDashboardTab === 'locker' ? (
          <div className="space-y-8 animate-fadeIn">
            <UserTeamHero 
              teamId={favoriteTeamId} 
              score={dynamicScore} // ENVIA A PONTUAÇÃO DINÂMICA AQUI
              lastGame={lastGame} 
              nextGame={nextGame} 
              teamsDataMap={teamsDataMap} 
            />

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-3 gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-wider">Week {currentWeek}</h2>
                  <p className="text-gray-500 text-xs font-medium mt-0.5">Current active week board inside your locker room.</p>
                </div>
                
                {myLeagues.length > 0 && (
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg p-1.5 w-full sm:w-auto">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest pl-2">Point Rules:</span>
                    <select
                      className="bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs font-bold text-white focus:outline-none appearance-none pr-8 cursor-pointer shadow-inner"
                      value={contextLeagueId || 'global'}
                      onChange={e => setContextLeagueId(e.target.value === 'global' ? null : e.target.value)}
                      style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1em' }}
                    >
                      <option value="global">🌎 Global Official (7/5/3)</option>
                      {myLeagues.map(l => <option key={l.id} value={l.id}>🛡️ {l.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {currentWeekGames.length === 0 ? (
                <div className="bg-neutral-900 border border-white/5 rounded-xl p-8 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">No matchups scheduled.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {currentWeekGames.map((game) => {
                    const existingPick = myGuesses.find(g => g.game_id?.toString() === game.id?.toString());
                    return (
                      <GameCard 
                        key={game.id} game={game} userTeamColor={userColor} 
                        homeTeam={teamsDataMap[game.home_team_id?.toString()] || { name: 'Home', abbr: 'HOME', color: '#171717' }}
                        awayTeam={teamsDataMap[game.away_team_id?.toString()] || { name: 'Away', abbr: 'AWAY', color: '#171717' }}
                        existingPick={existingPick} onPickChange={handlePickChange} isUnsaved={!!draftPicks[game.id.toString()]}
                        customRules={currentRules}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-fadeIn">
            <LeagueHub userColor={userColor} currentUserId={currentUserId} isAdmin={isAdmin} isVip={isVip} />
          </div>
        )}
      </div>

      {Object.keys(draftPicks).length > 0 && activeDashboardTab === 'locker' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md animate-slideUp">
          <div className="bg-neutral-900 border-2 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all duration-300" style={{ borderColor: saveStatus === 'error' ? '#ef4444' : userColor, boxShadow: `0 10px 40px ${saveStatus === 'error' ? '#ef444450' : userColor + '50'}` }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest transition-colors duration-300" style={{ color: saveStatus === 'error' ? '#ef4444' : userColor, textShadow: saveStatus !== 'error' ? `0 0 10px ${userColor}80` : 'none' }}>
                {saveStatus === 'error' ? 'Sync Failed' : 'Unsaved Changes'}
              </span>
              <span className="text-sm font-bold text-white">{Object.keys(draftPicks).length} Pick(s) pending</span>
            </div>
            <button onClick={handleSaveAll} disabled={saveStatus === 'saving'} className="px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-md disabled:opacity-50 text-xs sm:text-sm text-black" style={{ backgroundColor: saveStatus === 'error' ? '#ef4444' : userColor }}>
              {saveStatus === 'saving' ? 'Locking...' : saveStatus === 'error' ? 'Try Again' : 'Lock All'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}