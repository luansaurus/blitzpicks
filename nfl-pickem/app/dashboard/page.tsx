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
import { Shirt, Shield, Star, Crown, Trophy, Target, Minimize2, CheckCircle2, XCircle, LineChart } from 'lucide-react';

const getLuminance = (hex: string) => {
  if (!hex) return 0;
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(x => x + x).join('');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return ((r * 299) + (g * 587) + (b * 114)) / 1000;
};

const getBestColor = (pri: string, sec: string) => {
  const p = pri || '#111111';
  const s = sec || '#ff2a2a';
  return getLuminance(p) > getLuminance(s) ? p : s;
};

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
  
  const [userColor, setUserColor] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('blitz_accent') || '#E31837';
    return '#E31837';
  });
  const [ambientPrimary, setAmbientPrimary] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('blitz_header_bg') || '#013369';
    return '#013369';
  });
  const [ambientSecondary, setAmbientSecondary] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('blitz_header_sec') || '#E31837';
    return '#E31837';
  });

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
      
      if (profile.favorite_team_id) {
        setFavoriteTeamId(profile.favorite_team_id);
      }

      const [resTeams, resStandings, resGames, resGuesses, resUsers, resChamps, resMembers, resLeagues] = await Promise.all([
        supabase.from('teams').select('*'),
        supabase.from('standings').select('*'),
        supabase.from('games').select('*, stadium(name, city)').order('game_time', { ascending: true }),
        supabase.from('guesses').select('*'),
        supabase.from('profiles').select('id, nickname, score, global_titles, is_test, teams ( logo_url, abbreviation )'),
        supabase.from('championships').select('*'),
        supabase.from('league_members').select('league_id, user_id'),
        supabase.from('leagues').select('*')
      ]);

      if (resChamps.data) setChampionships(resChamps.data);

      const tMap: Record<string, any> = {};
      resTeams.data?.forEach(t => { 
        const record = resStandings.data?.find(s => s.team_id?.toString() === t.id.toString());
        tMap[t.id.toString()] = { 
          name: t.name, abbr: t.abbreviation, color: getBestColor(t.primary_color, t.secondary_color), logo: t.logo_url,
          record: record ? `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''}` : '0-0' 
        }; 
        
        if (profile.favorite_team_id && t.id.toString() === profile.favorite_team_id.toString()) {
          setUserColor(getBestColor(t.primary_color, t.secondary_color));
          setAmbientPrimary(t.primary_color || '#013369');
          setAmbientSecondary(t.secondary_color || '#E31837');
        }
      });
      setTeamsDataMap(tMap);

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

      if (resMembers.data && resLeagues.data) {
        const lMap: Record<string, string[]> = {};
        const userLeaguesTemp: any[] = [];
        resMembers.data.forEach((m: any) => {
          if (!lMap[m.league_id]) lMap[m.league_id] = [];
          lMap[m.league_id].push(m.user_id);
          
          if (m.user_id === session.user.id) {
            const found = resLeagues.data.find(l => l.id === m.league_id);
            if (found) userLeaguesTemp.push(found);
          }
        });
        setLeagueMembersMap(lMap);
        setMyLeagues(userLeaguesTemp);
      }

      setLoading(false);
    }
    loadDashboardData();
  }, [router, supabase]);

  useEffect(() => {
    if (activeDashboardTab === 'locker' && currentUserId && !loading) {
      async function refreshLeagues() {
        const [resMembers, resLeagues] = await Promise.all([
          supabase.from('league_members').select('league_id, user_id'),
          supabase.from('leagues').select('*')
        ]);
        if (resMembers.data && resLeagues.data) {
          const lMap: Record<string, string[]> = {};
          const userLeaguesTemp: any[] = [];
          resMembers.data.forEach((m: any) => {
            if (!lMap[m.league_id]) lMap[m.league_id] = [];
            lMap[m.league_id].push(m.user_id);
            if (m.user_id === currentUserId) {
              const found = resLeagues.data.find(l => l.id === m.league_id);
              if (found) userLeaguesTemp.push(found);
            }
          });
          setLeagueMembersMap(lMap);
          setMyLeagues(userLeaguesTemp);
        }
      }
      refreshLeagues();
    }
  }, [activeDashboardTab, currentUserId, supabase]);

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
  const safeContextLeagueId = activeContextLeague ? activeContextLeague.id : null;
  const currentRules = activeContextLeague ? { exact: activeContextLeague.pts_exact, diff: activeContextLeague.pts_diff, winner: activeContextLeague.pts_winner } : undefined;

  useEffect(() => {
    if (!loading && contextLeagueId && !activeContextLeague) {
      setContextLeagueId(null);
    }
  }, [loading, contextLeagueId, activeContextLeague]);

  const isSeasonOver = useMemo(() => {
    return games.length > 0 && games.every(g => g.status === 'finished');
  }, [games]);

  const leagueWinner = useMemo(() => {
    if (!isSeasonOver || !allUsers.length) return null;
    const rulesToUse = currentRules || { exact: 7, diff: 5, winner: 3 };
    const validUserIds = safeContextLeagueId ? (leagueMembersMap[safeContextLeagueId] || []) : allUsers.map(u => u.id);
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
  }, [isSeasonOver, safeContextLeagueId, currentRules, allUsers, allGuesses, games, leagueMembersMap]);

  const { dynamicScore, currentContextRank } = useMemo(() => {
    let myScore = 0;
    let myRank = null;

    if (!games.length || !allUsers.length || !currentUserId) return { dynamicScore: 0, currentContextRank: null };

    const rulesToUse = currentRules || { exact: 7, diff: 5, winner: 3 };
    const validUserIds = safeContextLeagueId ? (leagueMembersMap[safeContextLeagueId] || []) : allUsers.map(u => u.id);
    const competingUsers = allUsers.filter(u => validUserIds.includes(u.id));

    const scores = competingUsers.map(user => {
      let total = 0;
      let exactHits = 0;
      let diffHits = 0;

      const uGuesses = allGuesses.filter(g => g.user_id === user.id);
      uGuesses.forEach(guess => {
        const game = games.find(g => g.id === guess.game_id);
        if (game && (game.status === 'finished' || game.status === 'in_progress')) {
          const res = getPickResult(game, guess, rulesToUse);
          total += res.points;
          if (res.points === rulesToUse.exact) exactHits++;
          if (res.points === rulesToUse.diff) diffHits++;
        }
      });
      return { id: user.id, total, exactHits, diffHits, nickname: user.nickname, global_titles: user.global_titles };
    });

    scores.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
      if (b.diffHits !== a.diffHits) return b.diffHits - a.diffHits;
      if ((b.global_titles || 0) !== (a.global_titles || 0)) return (b.global_titles || 0) - (a.global_titles || 0);
      return (a.nickname || '').localeCompare(b.nickname || '');
    });
    
    for (let i = 0; i < scores.length; i++) {
      if (i > 0) {
        const prev = scores[i - 1] as any;
        const curr = scores[i] as any;
        if (
          curr.total === prev.total &&
          curr.exactHits === prev.exactHits &&
          curr.diffHits === prev.diffHits &&
          (curr.global_titles || 0) === (prev.global_titles || 0)
        ) {
          curr.displayRank = prev.displayRank; 
        } else {
          curr.displayRank = i + 1;
        }
      } else {
        (scores[i] as any).displayRank = 1;
      }
      
      if (scores[i].id === currentUserId) {
        myRank = (scores[i] as any).displayRank;
        myScore = scores[i].total;
      }
    }

    return { dynamicScore: myScore, currentContextRank: myRank };
  }, [games, allGuesses, allUsers, currentRules, safeContextLeagueId, currentUserId, leagueMembersMap]);

  const userStats = useMemo(() => {
    let exact = 0, margin = 0, winner = 0, miss = 0;
    let totalPts = 0;
    const weeksPlayed = new Set<string>();

    const rulesToUse = currentRules || { exact: 7, diff: 5, winner: 3 };

    myGuesses.forEach(guess => {
      const game = games.find(g => g.id === guess.game_id);
      if (game && game.status === 'finished') {
        const res = getPickResult(game, guess, rulesToUse);
        totalPts += res.points;
        weeksPlayed.add(game.week?.toString() || '1');

        if (res.points === rulesToUse.exact) exact++;
        else if (res.points === rulesToUse.diff) margin++;
        else if (res.points === rulesToUse.winner) winner++;
        else miss++;
      }
    });

    const playedCount = weeksPlayed.size;
    const avg = playedCount > 0 ? (totalPts / playedCount).toFixed(1) : '0.0';

    return { exact, margin, winner, miss, avg, playedCount };
  }, [myGuesses, games, currentRules]);

  useEffect(() => {
    async function recordChampionship() {
      if (!isSeasonOver || !leagueWinner) return;
      
      const firstGameTime = games[0]?.game_time;
      const seasonYear = firstGameTime ? new Date(firstGameTime).getFullYear() : new Date().getFullYear();

      const { data, error } = await supabase.from('championships').insert({
        league_id: safeContextLeagueId || null,
        winner_id: leagueWinner.id,
        season_year: seasonYear
      }).select().single();

      if (!error && data) {
        setChampionships(prev => [...prev, data]);
        if (!safeContextLeagueId) {
          setAllUsers(prev => prev.map(u => u.id === leagueWinner.id ? { ...u, global_titles: (u.global_titles || 0) + 1 } : u));
        }
      }
    }
    recordChampionship();
  }, [isSeasonOver, leagueWinner, safeContextLeagueId, games, supabase]);

  if (loading) return <LoadingScreen />;

  const currentWeekGames = games.filter(game => game.week?.toString() === currentWeek.toString());
  const isCurrentUserWinner = leagueWinner?.id === currentUserId;
  const leagueWinsCount = safeContextLeagueId ? championships.filter(c => c.league_id === safeContextLeagueId && c.winner_id === leagueWinner?.id).length : 0;
  
  const rankSuffix = currentContextRank === 1 ? 'ST' : currentContextRank === 2 ? 'ND' : currentContextRank === 3 ? 'RD' : 'TH';

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans pb-40 sm:pb-48 lg:pb-56 relative overflow-hidden">
      
      <div 
        className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[150px] opacity-30 pointer-events-none z-0 transition-colors duration-1000"
        style={{ backgroundColor: ambientPrimary }}
      />
      <div 
        className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full blur-[150px] opacity-20 pointer-events-none z-0 transition-colors duration-1000"
        style={{ backgroundColor: ambientSecondary }}
      />
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-overlay"
        style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
      />

      <div className="relative z-10">
        <Header />
        
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8 mt-4">
          
          <div className="flex bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 w-full max-w-sm mx-auto shadow-xl">
            <button 
              onClick={() => setActiveDashboardTab('locker')} 
              className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeDashboardTab === 'locker' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
              style={activeDashboardTab === 'locker' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
            >
              <Shirt size={16} /> My Locker
            </button>
            <button 
              onClick={() => setActiveDashboardTab('leagues')} 
              className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeDashboardTab === 'leagues' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
              style={activeDashboardTab === 'leagues' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
            >
              <Shield size={16} /> Leagues
            </button>
          </div>

          {activeDashboardTab === 'locker' ? (
            <div className="space-y-6 sm:space-y-8 animate-fadeIn">
              
              {/* O NOVO BANNER CONTEXTUAL (ULTRA COMPACTO NO MOBILE) */}
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 sm:p-4 flex flex-row items-center justify-between gap-2 sm:gap-4 shadow-lg">
                
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="hidden sm:flex w-10 h-10 rounded-lg items-center justify-center border shadow-inner shrink-0" style={{ backgroundColor: `${userColor}20`, borderColor: `${userColor}50` }}>
                    <Trophy style={{ color: userColor }} size={16} className="drop-shadow-md" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-sans text-[7px] sm:text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">League Rules</span>
                    
                    {myLeagues.length > 0 ? (
                      <select
                        className="bg-transparent font-sport font-bold text-xs sm:text-base uppercase tracking-wider text-white focus:outline-none appearance-none pr-5 sm:pr-6 cursor-pointer drop-shadow-md w-full truncate"
                        value={safeContextLeagueId || 'global'}
                        onChange={e => setContextLeagueId(e.target.value === 'global' ? null : e.target.value)}
                        style={{ 
                          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, 
                          backgroundRepeat: 'no-repeat', 
                          backgroundPosition: 'right center', 
                          backgroundSize: '1em' 
                        }}
                      >
                        <option className="bg-[#111111]" value="global">Global Leaderboard (7/5/3)</option>
                        {myLeagues.map(league => (
                          <option className="bg-[#111111]" key={league.id} value={league.id}>
                            {league.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-sport font-bold text-xs sm:text-base uppercase tracking-wider text-white drop-shadow-md pt-0.5 truncate">
                        Global Leaderboard (7/5/3)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-5 bg-white/5 border border-white/10 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-xl shadow-inner shrink-0">
                  <div className="flex flex-col items-center">
                    <span className="font-sans text-[7px] sm:text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Rank</span>
                    <div className="flex items-baseline leading-none">
                      <span className="font-jersey text-lg sm:text-2xl text-white drop-shadow-md">{currentContextRank || '-'}</span>
                      {currentContextRank && <span className="font-sans text-[8px] sm:text-[9px] font-black text-gray-500 ml-0.5 hidden sm:inline-block">{rankSuffix}</span>}
                    </div>
                  </div>
                  <div className="w-[1px] h-6 sm:h-7 bg-white/10" />
                  <div className="flex flex-col items-center">
                    <span className="font-sans text-[7px] sm:text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Points</span>
                    <span className="font-jersey text-lg sm:text-2xl leading-none drop-shadow-md" style={{ color: userColor }}>{dynamicScore}</span>
                  </div>
                </div>
              </div>

              {isSeasonOver && leagueWinner && (
                <div className={`w-full backdrop-blur-2xl border-2 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl ${isCurrentUserWinner ? 'bg-gradient-to-br from-amber-500/20 via-yellow-600/10 to-amber-500/20 border-yellow-500/30 shadow-[0_0_40px_rgba(245,158,11,0.2)]' : 'bg-black/60 border-white/10'}`}>
                  <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
                    <span className="text-4xl animate-bounce drop-shadow-md">
                      {isCurrentUserWinner ? <Crown size={42} className="text-yellow-400" /> : <Star size={42} className="text-slate-400" />}
                    </span>
                    <div>
                      <h2 className={`font-jersey text-3xl sm:text-4xl uppercase tracking-wider leading-none mb-1 ${isCurrentUserWinner ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'text-slate-300'}`}>
                        {isCurrentUserWinner ? "Congratulations, Champion!" : "Season Finished!"}
                      </h2>
                      <p className="font-sans text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">
                        {safeContextLeagueId ? `League "${activeContextLeague?.name}"` : "Official Global Board"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-black/60 px-5 py-3 border border-white/10 rounded-2xl shadow-inner">
                    {leagueWinner.teams?.logo_url && <img src={leagueWinner.teams.logo_url} className="w-10 h-10 object-contain drop-shadow-lg" alt="" />}
                    <div className="flex flex-col">
                      <span className="font-sport text-lg sm:text-xl font-bold uppercase tracking-wider text-white flex flex-wrap items-center gap-2 leading-none pb-1">
                        {leagueWinner.nickname}
                        <div className="flex items-center gap-1">
                          {leagueWinner.global_titles > 0 && (
                            <span className="font-sans text-[8px] font-black text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded inline-flex items-center gap-1 shadow-sm">
                              <Crown size={10} /> x{leagueWinner.global_titles}
                            </span>
                          )}
                          {safeContextLeagueId && leagueWinsCount > 0 && (
                            <span className="font-sans text-[8px] font-black text-slate-300 bg-slate-500/10 border border-slate-400/20 px-1.5 py-0.5 rounded inline-flex items-center gap-1 shadow-sm">
                              <Star size={10} /> x{leagueWinsCount}
                            </span>
                          )}
                        </div>
                      </span>
                      <span className="font-sans text-[9px] font-black text-gray-500 uppercase tracking-widest">{leagueWinner.total} TOTAL PTS</span>
                    </div>
                  </div>
                </div>
              )}

              <UserTeamHero key={dynamicScore} teamId={favoriteTeamId} score={dynamicScore} lastGame={lastGame} nextGame={nextGame} teamsDataMap={teamsDataMap} />

              {/* ==================================================== */}
              {/* NOVA SECÇÃO: METRICS RIBBON (MUITO COMPACTO NO MOBILE) */}
              {/* ==================================================== */}
              <div className="space-y-1.5 sm:space-y-2 mt-2 sm:mt-4">
                <div className="flex items-center gap-2 px-2">
                  <span className="font-sans text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500">Your Season Metrics</span>
                </div>
                
                <div className="bg-black/40 border border-white/5 rounded-xl sm:rounded-2xl flex flex-row items-stretch divide-x divide-white/5 shadow-inner w-full">
                  
                  {/* Exact Scores */}
                  <div className="flex-1 py-2 sm:py-3 flex flex-col items-center justify-center hover:bg-white/[0.02] transition-colors px-1">
                    
                    <span className="font-jersey text-xl sm:text-3xl text-white drop-shadow-md leading-none mb-1">{userStats.exact}</span>
                    <span className="font-sans text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-green-500 text-center leading-tight">Exact</span>
                  </div>
                  
                  {/* Correct Margin */}
                  <div className="flex-1 py-2 sm:py-3 flex flex-col items-center justify-center hover:bg-white/[0.02] transition-colors px-1">
                    <span className="font-jersey text-xl sm:text-3xl text-white drop-shadow-md leading-none mb-1">{userStats.margin}</span>
                    <span className="font-sans text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-blue-500 text-center leading-tight">Margin</span>
                  </div>
                  
                  {/* Correct Winner */}
                  <div className="flex-1 py-2 sm:py-3 flex flex-col items-center justify-center hover:bg-white/[0.02] transition-colors px-1">
                    <span className="font-jersey text-xl sm:text-3xl text-white drop-shadow-md leading-none mb-1">{userStats.winner}</span>
                    <span className="font-sans text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-amber-500 text-center leading-tight">Winner</span>
                  </div>
                  
                  {/* Misses */}
                  <div className="flex-1 py-2 sm:py-3 flex flex-col items-center justify-center hover:bg-white/[0.02] transition-colors px-1">
                    <span className="font-jersey text-xl sm:text-3xl text-white drop-shadow-md leading-none mb-1">{userStats.miss}</span>
                    <span className="font-sans text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-red-500 text-center leading-tight">Missed</span>
                  </div>
                  
                  {/* Avg Pts / Week */}
                  <div className="flex-1 py-2 sm:py-3 flex flex-col items-center justify-center hover:bg-white/[0.02] transition-colors bg-white/[0.01] px-1 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-0.5 sm:h-1" style={{ backgroundColor: userColor }} />
                    <span className="font-jersey text-xl sm:text-3xl text-white drop-shadow-md leading-none mb-1">{userStats.avg}</span>
                    <span className="font-sans text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-gray-500 text-center leading-tight">Avg/Wk</span>
                  </div>
                  
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-4 gap-4">
                  <div>
                    <h2 className="font-jersey text-3xl sm:text-4xl uppercase tracking-widest text-white drop-shadow-md">
                      WEEK <span style={{ color: userColor }}>{currentWeek}</span>
                    </h2>
                    <p className="font-sans text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-widest mt-1">
                      Cards are scoring based on your active league rules.
                    </p>
                  </div>
                </div>

                {currentWeekGames.length === 0 ? (
                  <div className="bg-black/60 border border-white/5 rounded-2xl p-10 text-center font-sans text-[10px] sm:text-xs text-gray-500 font-black uppercase tracking-widest shadow-inner">
                    No matchups scheduled.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
          <div 
            className="fixed bottom-24 sm:bottom-16 lg:bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-md animate-slideUp"
            style={{ zIndex: 999999 }}
          >
            <div 
              className="bg-black/95 backdrop-blur-3xl border-t-4 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all duration-300 shadow-[0_25px_60px_rgba(0,0,0,0.9)]" 
              style={{ borderTopColor: saveStatus === 'error' ? '#ef4444' : userColor }}
            >
              <div className="flex flex-col gap-1 pl-2">
                <span 
                  className="font-sans text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors duration-300" 
                  style={{ color: saveStatus === 'error' ? '#ef4444' : userColor, textShadow: saveStatus !== 'error' ? `0 0 10px ${userColor}80` : 'none' }}
                >
                  {saveStatus === 'error' ? 'Sync Failed' : 'Unsaved Changes'}
                </span>
                <span className="font-sport font-bold text-base sm:text-xl text-white uppercase tracking-wider drop-shadow-md">
                  {Object.keys(draftPicks).length} Pick(s) pending
                </span>
              </div>
              <button 
                onClick={handleSaveAll} 
                disabled={saveStatus === 'saving'} 
                className="px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl font-sport font-bold text-base sm:text-lg uppercase tracking-wider transition-all shadow-xl hover:scale-105 disabled:opacity-50 text-black flex items-center justify-center min-w-[110px] sm:min-w-[120px]" 
                style={{ backgroundColor: saveStatus === 'error' ? '#ef4444' : userColor, boxShadow: `0 0 20px ${saveStatus === 'error' ? '#ef444450' : userColor + '50'}` }}
              >
                {saveStatus === 'saving' ? 'LOCKING...' : saveStatus === 'error' ? 'TRY AGAIN' : 'LOCK ALL'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}