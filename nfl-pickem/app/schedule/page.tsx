"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import GameCard from '../../components/scoreboard/GameCard';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';

const TBD_TEAM = { 
  name: 'To Be Determined', 
  abbr: 'TBD', 
  color: '#333333', 
  logo: 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg',
  conference: null
};

export default function SchedulePage() {
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  const [teamsDataMap, setTeamsDataMap] = useState<Record<string, any>>({});
  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  
  const [draftPicks, setDraftPicks] = useState<Record<string, { home: number, away: number }>>({});
  const [isSavingPicks, setIsSavingPicks] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [seasonMode, setSeasonMode] = useState<'regular' | 'playoffs'>('regular');
  const [userColor, setUserColor] = useState('#E31837');
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const supabase = createClient();

  const playoffOrder = ['WC', 'DR', 'CC', 'SB'];

  const getWeekName = (weekCode: string) => {
    const names: Record<string, string> = {
      'WC': 'Wild Card Weekend',
      'DR': 'Divisional Round',
      'CC': 'Conference Championships',
      'SB': 'Super Bowl LXI'
    };
    return names[weekCode] || `Week ${weekCode}`;
  };

  useEffect(() => {
    async function loadScheduleData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: profile } = await supabase.from('profiles').select('favorite_team_id').eq('id', session.user.id).single();
      if (profile?.favorite_team_id) {
        const { data: teamInfo } = await supabase.from('teams').select('primary_color').eq('id', profile.favorite_team_id).single();
        if (teamInfo?.primary_color) setUserColor(teamInfo.primary_color);
      } else if (typeof window !== "undefined") {
         const savedAccent = localStorage.getItem('blitz_accent');
         if (savedAccent) setUserColor(savedAccent);
      }

      const { data: teams } = await supabase.from('teams').select('*');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { 
        tMap[t.id.toString()] = { 
          name: t.name, 
          abbr: t.abbreviation, 
          color: t.primary_color, 
          logo: t.logo_url,
          conference: t.conference 
        }; 
      });
      setTeamsDataMap(tMap);

      const { data: gamesData } = await supabase.from('games').select('*, stadium(name, city)').order('game_time', { ascending: true });
      if (gamesData && gamesData.length > 0) {
        const grouped = gamesData.reduce((acc, g) => {
          let w = g.week || '1';
          if (w === 'AFCC' || w === 'NFCC') w = 'CC';
          if (!acc[w]) acc[w] = [];
          acc[w].push(g);
          return acc;
        }, {} as Record<string, any[]>);
        
        setGamesByWeek(grouped);

        const sortedWeeks = Object.keys(grouped)
          .filter(w => !playoffOrder.includes(w))
          .sort((a, b) => Number(a) - Number(b));
        
        const activeWeek = sortedWeeks.find(week => !grouped[week].every((g: any) => g.status === 'finished')) || sortedWeeks[sortedWeeks.length - 1];
        setExpandedWeek(activeWeek);
      }

      const { data: guessesData } = await supabase.from('guesses').select('*').eq('user_id', session.user.id);
      if (guessesData) setMyGuesses(guessesData);

      setLoading(false);
    }
    loadScheduleData();
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

  const filteredWeeks = Object.keys(gamesByWeek).filter(week => {
    if (seasonMode === 'regular') return !playoffOrder.includes(week);
    return playoffOrder.includes(week);
  }).sort((a, b) => {
    if (seasonMode === 'regular') return Number(a) - Number(b);
    return playoffOrder.indexOf(a) - playoffOrder.indexOf(b);
  });

  if (loading) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32 relative">
      <Header />
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 mt-4">
        
        <div className="border-b border-white/10 pb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider">
                Other <span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80, 0 1px 2px rgba(255,255,255,0.2)` }}>Picks</span>
              </h1>
              <p className="text-gray-400 mt-1 font-medium text-xs sm:text-sm">Manage all your predictions for the entire season.</p>
            </div>

            <div className="flex bg-neutral-900 border border-white/10 p-1 rounded-lg w-fit shadow-lg">
              <button
                onClick={() => { setSeasonMode('regular'); setExpandedWeek(null); }}
                className={`px-4 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-colors ${
                  seasonMode === 'regular' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Regular Season
              </button>
              <button
                onClick={() => { setSeasonMode('playoffs'); setExpandedWeek('WC'); }}
                className={`px-4 py-2 rounded-md text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${
                  seasonMode === 'playoffs' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Playoffs 🏆
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredWeeks.length === 0 ? (
            <div className="bg-neutral-900 border border-white/5 rounded-xl p-8 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
              No games scheduled for this phase yet.
            </div>
          ) : (
            filteredWeeks.map(week => {
              const isWeekOpen = expandedWeek === week;
              const weekGames = gamesByWeek[week];
              const isSuperBowlWeek = week === 'SB';

              return (
                <div key={week} className={`rounded-xl border overflow-hidden transition-all ${isSuperBowlWeek && isWeekOpen ? 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]' : 'border-white/5 shadow-sm bg-neutral-900/30'}`}>
                  
                  <button
                    onClick={() => setExpandedWeek(isWeekOpen ? null : week)}
                    className={`w-full flex justify-between items-center p-4 sm:p-5 transition text-left border-b border-white/5 ${isSuperBowlWeek ? 'bg-gradient-to-r from-purple-900/40 via-black to-amber-900/40 hover:from-purple-900/60' : 'bg-neutral-900/80 hover:bg-neutral-800'}`}
                  >
                    <div className="flex items-center gap-3">
                      {isWeekOpen && !isSuperBowlWeek && (
                        <div className="w-1.5 h-6 rounded-full shadow-lg" style={{ backgroundColor: userColor, boxShadow: `0 0 10px ${userColor}80` }}></div>
                      )}
                      {isWeekOpen && isSuperBowlWeek && (
                        <div className="text-xl animate-pulse">🏆</div>
                      )}
                      
                      <span className={`font-black text-base uppercase tracking-widest ${isWeekOpen ? 'text-white' : 'text-gray-400'}`}>
                        {getWeekName(week)}
                      </span>
                      
                      {isWeekOpen && !isSuperBowlWeek && (
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.5 bg-white/10 rounded text-white tracking-widest hidden sm:inline-block">
                          Active View
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs font-bold shrink-0">
                      {isWeekOpen ? '▲ Collapse' : '▼ Expand'}
                    </span>
                  </button>

                  {isWeekOpen && (
                    <div className={`p-3 sm:p-4 ${isSuperBowlWeek ? 'bg-black/40' : 'bg-black/20'} animate-fadeIn`}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                        {weekGames.map((game) => {
                          const existingPick = myGuesses.find(g => g.game_id?.toString() === game.id?.toString());
                          const isUnsaved = !!draftPicks[game.id.toString()];

                          const homeTeam = teamsDataMap[game.home_team_id?.toString()] || TBD_TEAM;
                          const awayTeam = teamsDataMap[game.away_team_id?.toString()] || TBD_TEAM;

                          return (
                            <GameCard 
                              key={game.id} 
                              game={game} 
                              userTeamColor={userColor} 
                              homeTeam={homeTeam}
                              awayTeam={awayTeam}
                              existingPick={existingPick}
                              onPickChange={handlePickChange}
                              isUnsaved={isUnsaved}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              );
            })
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
            <button 
              onClick={handleSaveAll} 
              disabled={isSavingPicks} 
              className="px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-md disabled:opacity-50 text-xs sm:text-sm" 
              style={{ backgroundColor: userColor, color: '#000' }}
            >
              {isSavingPicks ? 'Locking...' : 'Lock All'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}