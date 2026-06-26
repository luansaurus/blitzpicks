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
  const supabase = createClient();
  const router = useRouter();

  const [games, setGames] = useState<any[]>([]);
  const [teamsDataMap, setTeamsDataMap] = useState<Record<string, any>>({});
  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  const [allGuesses, setAllGuesses] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [leagueMembersMap, setLeagueMembersMap] = useState<Record<string, string[]>>({});
  
  const [championships, setChampionships] = useState<any[]>([]);
  
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

  useEffect(() => {
    const savedLeague = localStorage.getItem('last_selected_league');
    if (savedLeague) setContextLeagueId(savedLeague);
  }, []);

  useEffect(() => {
    if (contextLeagueId) localStorage.setItem('last_selected_league', contextLeagueId);
    else localStorage.removeItem('last_selected_league');
  }, [contextLeagueId]);

  useEffect(() => {
    async function loadDashboardData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setCurrentUserId(session.user.id);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (!profile?.nickname) { router.push('/setup'); return; }

      setIsAdmin(profile.is_admin);
      setIsVip(profile.is_vip);
      if (profile.favorite_team_id) setFavoriteTeamId(profile.favorite_team_id);

      const [resTeams, resStandings, resGames, resGuesses, resMembers, resUsers, resChamps] = await Promise.all([
        supabase.from('teams').select('*'),
        supabase.from('standings').select('*'),
        supabase.from('games').select('*, stadium(name, city)').order('game_time', { ascending: true }),
        supabase.from('guesses').select('*'),
        supabase.from('league_members').select('league_id, user_id, leagues(*)'),
        supabase.from('profiles').select('id, nickname, score, global_titles, is_test, teams ( logo_url, abbreviation )'),
        supabase.from('championships').select('*')
      ]);

      if (resChamps.data) setChampionships(resChamps.data);

      const tMap: Record<string, any> = {};
      resTeams.data?.forEach(t => { 
        const record = resStandings.data?.find(s => s.team_id?.toString() === t.id.toString());
        tMap[t.id.toString()] = { 
          name: t.name, abbr: t.abbreviation, color: t.primary_color, logo: t.logo_url,
          record: record ? `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''}` : '0-0' 
        }; 
      });
      setTeamsDataMap(tMap);

      const savedAccent = localStorage.getItem('blitz_accent');
      if (savedAccent) setUserColor(savedAccent);

      if (resGames.data && resGames.data.length > 0) {
        setGames(resGames.data);
        if (profile.favorite_team_id) {
          const teamGames = resGames.data.filter(g => g.home_team_id?.toString() === profile.favorite_team_id?.toString() || g.away_team_id?.toString() === profile.favorite_team_id?.toString());
          const finished = teamGames.filter(g => g.status === 'finished').sort((a, b) => new Date(b.game_time).getTime() - new Date(a.game_time).getTime());
          const pending = teamGames.filter(g => g.status !== 'finished').sort((a, b) => new Date(a.game_time).getTime() - new Date(b.game_time).getTime());
          setLastGame(finished[0] || null);
          setNextGame(pending[0] || null);
        }

        const grouped = resGames.data.reduce((acc, g) => { const w = g.week || '1'; if (!acc[w]) acc[w] = []; acc[w].push(g); return acc; }, {} as Record<string, any[]>);
        const sortedWeeks = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
        setCurrentWeek(sortedWeeks.find(w => !grouped[w].every((game: any) => game.status === 'finished')) || sortedWeeks[sortedWeeks.length - 1]);
      }

      if (resGuesses.data) setMyGuesses(resGuesses.data.filter(g => g.user_id === session.user.id));
      setAllGuesses(resGuesses.data || []);
      setAllUsers((resUsers.data || []).filter(u => !u.is_test));

      if (resMembers.data) {
        const leaguesMap: Record<string, string[]> = {};
        const userLeaguesTemp: any[] = [];
        resMembers.data.forEach((m: any) => {
          if (!leaguesMap[m.league_id]) leaguesMap[m.league_id] = [];
          leaguesMap[m.league_id].push(m.user_id);
          if (m.user_id === session.user.id) {
            const f = m.leagues;
            if (f) userLeaguesTemp.push(Array.isArray(f) ? f[0] : f);
          }
        });
        setLeagueMembersMap(leaguesMap);
        setMyLeagues(userLeaguesTemp);
      }

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
    setSaveStatus('saving');
    const payload = Object.entries(draftPicks).map(([gameId, scores]) => ({
      user_id: currentUserId,
      game_id: parseInt(gameId),
      home_guess: scores.home,
      away_guess: scores.away
    }));

    const { error } = await supabase.from('guesses').upsert(payload, { onConflict: 'user_id,game_id' });
    if (!error) {
      const { data: newGuesses } = await supabase.from('guesses').select('*').eq('user_id', currentUserId);
      if (newGuesses) setMyGuesses(newGuesses);
      setDraftPicks({});
      setSaveStatus('idle');
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const activeContextLeague = myLeagues.find(l => l.id === contextLeagueId);
  const currentRules = activeContextLeague ? { exact: activeContextLeague.pts_exact, diff: activeContextLeague.pts_diff, winner: activeContextLeague.pts_winner } : undefined;

  const isSeasonOver = useMemo(() => {
    return games.length > 0 && games.every(g => g.status === 'finished');
  }, [games]);

  const leagueWinner = useMemo(() => {
    if (!isSeasonOver || !allUsers.length) return null;
    const rulesToUse = currentRules || { exact: 7, diff: 5, winner: 3 };
    const validUserIds = contextLeagueId ? (leagueMembersMap[contextLeagueId] || []) : allUsers.map(u => u.id);
    const competingUsers = allUsers.filter(u => validUserIds.includes(u.id));

    const scores = competingUsers.map(user => {
      let total = 0;
      const uGuesses = allGuesses.filter(g => g.user_id === user.id);
      uGuesses.forEach(guess => {
        const game = games.find(g => g.id === guess.game_id);
        if (game) total += getPickResult(game, guess, rulesToUse).points;
      });
      return { ...user, total };
    });

    scores.sort((a, b) => b.total - a.total);
    return scores[0] || null;
  }, [isSeasonOver, contextLeagueId, currentRules, allUsers, allGuesses, games, leagueMembersMap]);

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

  // MOTOR SILENCIOSO: Atualiza o banco e o estado local imediatamente
  useEffect(() => {
    async function recordChampionship() {
      if (!isSeasonOver || !leagueWinner) return;
      
      // CORREÇÃO DO ANO DA TEMPORADA: Pegar o primeiro jogo da matriz (ex: Setembro) em vez do último (Fevereiro do ano seguinte)
      const firstGameTime = games[0]?.game_time;
      const seasonYear = firstGameTime ? new Date(firstGameTime).getFullYear() : new Date().getFullYear();

      const { data, error } = await supabase.from('championships').insert({
        league_id: contextLeagueId || null,
        winner_id: leagueWinner.id,
        season_year: seasonYear
      }).select().single();

      if (!error && data) {
        setChampionships(prev => [...prev, data]);
        if (!contextLeagueId) {
          setAllUsers(prev => prev.map(u => u.id === leagueWinner.id ? { ...u, global_titles: (u.global_titles || 0) + 1 } : u));
        }
      }
    }
    recordChampionship();
  }, [isSeasonOver, leagueWinner, contextLeagueId, games, supabase]);


  if (loading) return <LoadingScreen />;

  const currentWeekGames = games.filter(game => game.week?.toString() === currentWeek.toString());
  
  const isCurrentUserWinner = leagueWinner?.id === currentUserId;
  const showGoldTheme = !contextLeagueId || isCurrentUserWinner;

  const leagueWinsCount = contextLeagueId ? championships.filter(c => c.league_id === contextLeagueId && c.winner_id === leagueWinner?.id).length : 0;

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
            
            {isSeasonOver && leagueWinner && (
              <div className={`w-full border-2 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl ${isCurrentUserWinner ? 'bg-gradient-to-r from-amber-500/20 via-yellow-600/10 to-amber-500/20 border-yellow-500/30 shadow-[0_0_30px_rgba(245,158,11,0.15)]' : 'bg-gradient-to-r from-neutral-800/40 via-zinc-900/40 to-neutral-800/40 border-slate-400/30'}`}>
                <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
                  <span className="text-4xl animate-bounce">{isCurrentUserWinner ? '🌟' : '⭐'}</span>
                  <div>
                    <h2 className={`text-xl font-black uppercase tracking-wider ${isCurrentUserWinner ? 'text-yellow-400' : 'text-slate-300'}`}>
                      {isCurrentUserWinner ? "Congratulations, Champion!" : "Season Finished!"}
                    </h2>
                    <p className="text-xs font-medium text-gray-400 uppercase mt-0.5">
                      {contextLeagueId ? `League "${activeContextLeague?.name}"` : "Official Global Board"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-black/40 px-5 py-3 border border-white/5 rounded-xl">
                  {leagueWinner.teams?.logo_url && <img src={leagueWinner.teams.logo_url} className="w-8 h-8 object-contain" alt="" />}
                  <div className="flex flex-col">
                    
                    <span className="text-base font-black text-white flex flex-wrap items-center gap-2">
                      {leagueWinner.nickname}
                      <div className="flex items-center gap-1">
                        {leagueWinner.global_titles > 0 && (
                          <span className="text-[9px] font-black text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded">🌟 x{leagueWinner.global_titles}</span>
                        )}
                        {contextLeagueId && leagueWinsCount > 0 && (
                          <span className="text-[9px] font-black text-slate-300 bg-slate-500/10 border border-slate-400/20 px-1.5 py-0.5 rounded">⭐ x{leagueWinsCount}</span>
                        )}
                      </div>
                    </span>
                    
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{leagueWinner.total} TOTAL PTS</span>
                  </div>
                </div>
              </div>
            )}

            <UserTeamHero key={dynamicScore} teamId={favoriteTeamId} score={dynamicScore} lastGame={lastGame} nextGame={nextGame} teamsDataMap={teamsDataMap} />

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