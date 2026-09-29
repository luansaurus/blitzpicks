"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import GameCard from '../../components/scoreboard/GameCard';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { Trophy, AlertTriangle } from 'lucide-react';
import { getBestColor } from '@/lib/color';

const TBD_TEAM = { 
  name: 'Free Agent', 
  abbr: 'FA', 
  color: '#333333', 
  logo: 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg',
  conference: null
};



export default function SchedulePage() {
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  const [teamsDataMap, setTeamsDataMap] = useState<Record<string, any>>({});
  const [myGuesses, setMyGuesses] = useState<any[]>([]);
  
  const [draftPicks, setDraftPicks] = useState<Record<string, { home: number, away: number }>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [currentActiveWeek, setCurrentActiveWeek] = useState<string | null>(null); 
  
  const [seasonMode, setSeasonMode] = useState<'regular' | 'playoffs'>('regular');
  const [isWeek18Finished, setIsWeek18Finished] = useState(false);
  
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
        const { data: teamInfo } = await supabase.from('teams').select('primary_color, secondary_color').eq('id', profile.favorite_team_id).single();
        if (teamInfo) {
          setUserColor(getBestColor(teamInfo.primary_color, teamInfo.secondary_color));
          setAmbientPrimary(teamInfo.primary_color || '#013369');
          setAmbientSecondary(teamInfo.secondary_color || '#E31837');
        }
      } else if (typeof window !== "undefined") {
         const savedAccent = localStorage.getItem('blitz_accent');
         if (savedAccent) setUserColor(savedAccent);
      }

      const { data: teams } = await supabase.from('teams').select('*');
      const { data: standings } = await supabase.from('standings').select('*');
      
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { 
        const record = standings?.find(s => s.team_id?.toString() === t.id.toString());
        const recordStr = record ? `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''}` : '0-0';

        tMap[t.id.toString()] = { 
          name: t.name, 
          abbr: t.abbreviation, 
          color: getBestColor(t.primary_color, t.secondary_color), 
          logo: t.logo_url,
          conference: t.conference,
          record: recordStr
        }; 
      });
      setTeamsDataMap(tMap);

      const { data: gamesData } = await supabase.from('games').select('*, stadium(name, city)').order('game_time', { ascending: true });
      if (gamesData && gamesData.length > 0) {
        const w18Games = gamesData.filter(g => g.week === '18');
        const w18Done = w18Games.length > 0 && w18Games.every(g => g.status === 'finished');
        setIsWeek18Finished(w18Done);

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
        
        setCurrentActiveWeek(activeWeek); 
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
    setSaveStatus('saving');
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
      console.error("Failed to save picks:", error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
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
    <main className="min-h-screen bg-[#050505] text-white font-sans pb-40 sm:pb-56 relative overflow-hidden">
      
      {/* Atmosfera de Fundo Isolada */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[150px] opacity-30 transition-colors duration-1000"
          style={{ backgroundColor: ambientPrimary }}
        />
        <div 
          className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full blur-[150px] opacity-20 transition-colors duration-1000"
          style={{ backgroundColor: ambientSecondary }}
        />
        <div 
          className="absolute inset-0 opacity-20 mix-blend-overlay"
          style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
        />
      </div>

      <div className="relative z-10">
        <Header />
        
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 mt-4">
          
          <div className="border-b border-white/10 pb-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="font-jersey text-5xl sm:text-5xl uppercase tracking-widest text-white mb-1">
                  ALL <span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80` }}>MATCHUPS</span>
                </h1>
                <p className="text-gray-400 mt-1 font-sans font-bold text-xs sm:text-sm uppercase tracking-widest">Manage all your predictions for the entire season.</p>
                <p className="text-gray-500 mt-1 font-sans font-bold text-[9px] sm:text-[10px] uppercase tracking-widest">The points displayed are defined by the Global Points.</p>
              </div>

              <div className="flex bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 rounded-xl w-full sm:w-auto shadow-xl">
                <button
                  onClick={() => { setSeasonMode('regular'); setExpandedWeek(currentActiveWeek); }}
                  className={`flex-1 sm:flex-none px-4 py-3 rounded-lg font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center ${
                    seasonMode === 'regular' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                  }`}
                  style={seasonMode === 'regular' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
                >
                  Regular Season
                </button>
                <button
                  onClick={() => { setSeasonMode('playoffs'); setExpandedWeek('WC'); }}
                  className={`flex-1 sm:flex-none px-4 py-3 rounded-lg font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    seasonMode === 'playoffs' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                  }`}
                  style={seasonMode === 'playoffs' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
                >
                  <span className="inline-flex items-center gap-1.5">Playoffs <Trophy size={14} /></span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            
            {seasonMode === 'playoffs' && !isWeek18Finished && (
              <div className="bg-black/60 backdrop-blur-md border border-amber-500/20 rounded-2xl p-6 flex items-center justify-center text-center animate-fadeIn shadow-inner">
                <span className="text-amber-500 font-bold text-xs uppercase tracking-widest flex items-center gap-2 drop-shadow-md">
                  <AlertTriangle size={16} /> Playoff predictions will unlock after Week 18 is officially concluded.
                </span>
              </div>
            )}

            {filteredWeeks.length === 0 ? (
              <div className="bg-black/60 backdrop-blur-md border border-white/5 rounded-2xl p-10 text-center text-gray-500 font-bold uppercase tracking-widest text-xs shadow-inner">
                No games scheduled for this phase yet.
              </div>
            ) : (
              filteredWeeks.map(week => {
                const isWeekOpen = expandedWeek === week;
                const weekGames = gamesByWeek[week];
                const isSuperBowlWeek = week === 'SB';

                const isPlayoffWeek = playoffOrder.includes(week);
                const lockThisCard = isPlayoffWeek && !isWeek18Finished;

                const isCurrentWeek = week === currentActiveWeek;
                const isFinished = weekGames.length > 0 && weekGames.every(g => g.status === 'finished');

                return (
                  <div key={week} className={`rounded-2xl border overflow-hidden transition-all ${isSuperBowlWeek && isWeekOpen ? 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]' : isWeekOpen ? 'border-white/10 shadow-xl' : 'border-white/5 shadow-sm bg-black/40'}`}>
                    
                    <button
                      onClick={() => setExpandedWeek(isWeekOpen ? null : week)}
                      className={`w-full flex justify-between items-center p-4 sm:p-5 transition-colors text-left border-b border-transparent ${isSuperBowlWeek ? 'bg-gradient-to-r from-purple-900/40 via-black to-amber-900/40 hover:from-purple-900/60' : 'bg-black/60 hover:bg-white/[0.02]'}`}
                      style={isWeekOpen && !isSuperBowlWeek ? { borderBottomColor: 'rgba(255,255,255,0.05)' } : {}}
                    >
                      <div className="flex items-center gap-3">
                        {isWeekOpen && !isSuperBowlWeek && (
                          <div className="w-1.5 h-6 rounded-full shadow-lg" style={{ backgroundColor: userColor, boxShadow: `0 0 10px ${userColor}80` }}></div>
                        )}
                        {isWeekOpen && isSuperBowlWeek && (
                          <Trophy size={24} className="animate-pulse text-amber-400 drop-shadow-md" />
                        )}
                        
                        <span className={`font-jersey text-xl sm:text-2xl uppercase tracking-widest pt-1 leading-none ${isWeekOpen ? 'text-white' : 'text-gray-400'}`}>
                          {getWeekName(week)}
                        </span>
                        
                        {!isSuperBowlWeek && (
                          isCurrentWeek ? (
                            <span className="hidden sm:inline-flex items-center text-[9px] uppercase font-black px-2 py-0.5 bg-red-500/10 text-red-500 rounded border border-red-500/30 tracking-widest animate-pulse ml-2 shadow-inner">
                              Current Week
                            </span>
                          ) : isFinished ? (
                            <span className="hidden sm:inline-flex items-center text-[9px] uppercase font-black px-2 py-0.5 bg-white/5 text-gray-500 rounded border border-white/5 tracking-widest ml-2">
                              Finished
                            </span>
                          ) : (
                            <span className="hidden sm:inline-flex items-center text-[9px] uppercase font-black px-2 py-0.5 bg-white/5 text-gray-400 rounded border border-white/5 tracking-widest ml-2">
                              Upcoming
                            </span>
                          )
                        )}
                      </div>
                      <span className="text-gray-500 text-xs font-bold shrink-0">
                        {isWeekOpen ? '▲ Collapse' : '▼ Expand'}
                      </span>
                    </button>

                    {isWeekOpen && (
                      <div className={`p-4 sm:p-6 ${isSuperBowlWeek ? 'bg-black/40' : 'bg-black/20'} animate-fadeIn shadow-inner`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                                isPlayoffLocked={lockThisCard}
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
      </div>

      {/* Botão Flutuante (Muda para Fora do Relative Container) */}
      {Object.keys(draftPicks).length > 0 && (
        <div 
          className="fixed bottom-6 sm:bottom-10 lg:bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-md animate-slideUp"
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
    </main>
  );
}