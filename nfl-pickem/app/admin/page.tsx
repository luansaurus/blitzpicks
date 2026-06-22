"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import BroadcastBadge from '@/components/ui/BroadcastBadge';

export default function AdminPage() {
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  const [teamsDataMap, setTeamsDataMap] = useState<Record<string, any>>({});
  const [draftScores, setDraftScores] = useState<Record<string, { home: number | null, away: number | null }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [userColor, setUserColor] = useState('#f59e0b');
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAdminAndLoadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
      if (!profile?.is_admin) { router.push('/dashboard'); return; }

      if (typeof window !== "undefined") {
         const savedAccent = localStorage.getItem('blitz_accent');
         if (savedAccent) setUserColor(savedAccent);
      }

      const { data: teams } = await supabase.from('teams').select('*');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { tMap[t.id] = { name: t.name, abbr: t.abbreviation, logo: t.logo_url }; });
      setTeamsDataMap(tMap);

      const { data: allGames } = await supabase.from('games').select('*').order('game_time', { ascending: true });
      if (allGames) {
        const grouped = allGames.reduce((acc, game) => {
          const week = game.week || '1';
          if (!acc[week]) acc[week] = [];
          acc[week].push(game);
          return acc;
        }, {} as Record<string, any[]>);
        
        setGamesByWeek(grouped);
        const sortedWeeks = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
        const activeWeek = sortedWeeks.find(week => !grouped[week].every((g: any) => g.status === 'finished')) || sortedWeeks[sortedWeeks.length - 1];
        setExpandedWeek(activeWeek);
      }
      setLoading(false);
    }
    checkAdminAndLoadData();
  }, [router, supabase]);

  const handleScoreChange = (gameId: string | number, homeStr: string, awayStr: string, currentRealHome: number | null, currentRealAway: number | null) => {
    const gId = gameId.toString();
    if (homeStr === "" && awayStr === "") {
        setDraftScores(prev => { const next = { ...prev }; delete next[gId]; return next; });
        return;
    }
    const home = homeStr === "" ? null : parseInt(homeStr);
    const away = awayStr === "" ? null : parseInt(awayStr);
    if (home === currentRealHome && away === currentRealAway) {
      setDraftScores(prev => { const next = { ...prev }; delete next[gId]; return next; });
      return;
    }
    setDraftScores(prev => ({ ...prev, [gId]: { home, away } }));
  };

  const handleSaveAllScores = async () => {
    setIsSaving(true);
    const updates = Object.entries(draftScores).map(async ([gameId, scores]) => {
      return supabase.from('games').update({ home_score: scores.home, away_score: scores.away }).eq('id', parseInt(gameId));
    });

    try {
      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error !== null);
      if (hasError) throw new Error("Falha ao salvar um ou mais jogos.");

      const { data: updatedGames } = await supabase.from('games').select('*').order('game_time', { ascending: true });
      if (updatedGames) {
          const grouped = updatedGames.reduce((acc, game) => {
              const week = game.week || '1';
              if (!acc[week]) acc[week] = [];
              acc[week].push(game);
              return acc;
          }, {} as Record<string, any[]>);
          setGamesByWeek(grouped);
      }
      setDraftScores({});
      alert("✅ Resultados oficiais salvos e Leaderboard atualizado!");
    } catch (err) {
      alert("Erro ao salvar. Verifique se o placar é numérico.");
    } finally {
      setIsSaving(false);
    }
  };

  const blockNegativeKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === ',' || e.key === '.') e.preventDefault();
  };

  if (loading) return <LoadingScreen />;

  const weeks = Object.keys(gamesByWeek).sort((a, b) => Number(a) - Number(b));

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32">
      <Header />
      {/* Expandido para max-w-7xl para acomodar 5 colunas */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 mt-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider" style={{ color: userColor }}>Control Room</h1>
          <p className="text-gray-400 mt-1 font-medium text-xs sm:text-sm">Atualize os resultados oficiais. Os pontos serão distribuídos automaticamente.</p>
        </div>

        <div className="space-y-3">
          {weeks.map(week => {
            const isOpen = expandedWeek === week;
            return (
              <div key={week} className="bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden shadow-lg">
                <button onClick={() => setExpandedWeek(isOpen ? null : week)} className="w-full flex justify-between items-center p-4 bg-neutral-900 hover:bg-neutral-800/80 transition text-left">
                  <span className="font-black text-lg uppercase tracking-widest" style={{ color: userColor }}>Week {week}</span>
                  <span className="text-gray-500 font-bold text-sm shrink-0">{isOpen ? '▲ Collapse' : '▼ Expand'}</span>
                </button>

                {isOpen && (
                  <div className="p-4 bg-black/20 border-t border-white/5 animate-fadeIn">
                    {/* Grid com 5 colunas em telas xl */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {gamesByWeek[week].map((game) => {
                        const isUnsaved = !!draftScores[game.id.toString()];
                        const displayAway = draftScores[game.id.toString()]?.away !== undefined ? draftScores[game.id.toString()].away : game.away_score;
                        const displayHome = draftScores[game.id.toString()]?.home !== undefined ? draftScores[game.id.toString()].home : game.home_score;
                        const isFinished = game.status === 'finished';

                        const awayTeam = teamsDataMap[game.away_team_id];
                        const homeTeam = teamsDataMap[game.home_team_id];

                        return (
                          <div 
                            key={game.id} 
                            className={`flex flex-col p-3 rounded-xl border transition-colors shadow-sm ${isUnsaved ? 'bg-white/5' : 'border-white/5 bg-black/40'}`} 
                            style={isUnsaved ? { borderColor: userColor, boxShadow: `0 0 15px ${userColor}20` } : {}}
                          >
                            {/* Header do Card (Data, Hora e Status) */}
                            <div className="flex justify-between items-start mb-3 pb-2 border-b border-white/5">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">
                                  {new Date(game.game_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                </span>
                                <span className="text-[10px] font-bold text-gray-600">
                                  {new Date(game.game_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                {isUnsaved ? (
                                  <span className="text-[9px] font-black uppercase tracking-widest animate-pulse" style={{ color: userColor }}>Unsaved</span> 
                                ) : isFinished ? (
                                  <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Official</span> 
                                ) : (
                                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Pending</span>
                                )}
                              </div>
                            </div>

                            {/* Corpo do Card (Inputs) */}
                            <div className="flex flex-col gap-2 grow justify-center">
                              {/* Away Team Input */}
                              <div className="flex items-center justify-between bg-black/60 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  {awayTeam?.logo ? <img src={awayTeam.logo} alt="" className="w-5 h-5 object-contain shrink-0" /> : <div className="w-5 h-5 bg-white/5 rounded-full shrink-0" />}
                                  <span className="text-xs font-black uppercase text-gray-300 truncate">{awayTeam?.abbr || 'AWAY'}</span>
                                </div>
                                <input 
                                  type="number" 
                                  min="0" 
                                  onKeyDown={blockNegativeKeys}
                                  placeholder="-" 
                                  value={displayAway === null ? "" : displayAway} 
                                  onChange={(e) => handleScoreChange(game.id, displayHome?.toString() || "", e.target.value, game.home_score, game.away_score)} 
                                  className="w-12 h-9 bg-neutral-900 border border-white/10 rounded-md text-center text-sm font-black text-white focus:outline-none focus:border-transparent focus:ring-1 transition-all shrink-0" 
                                  style={{ '--tw-ring-color': userColor } as React.CSSProperties} 
                                />
                              </div>

                              {/* Home Team Input */}
                              <div className="flex items-center justify-between bg-black/60 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  {homeTeam?.logo ? <img src={homeTeam.logo} alt="" className="w-5 h-5 object-contain shrink-0" /> : <div className="w-5 h-5 bg-white/5 rounded-full shrink-0" />}
                                  <span className="text-xs font-black uppercase text-gray-300 truncate">{homeTeam?.abbr || 'HOME'}</span>
                                </div>
                                <input 
                                  type="number" 
                                  min="0" 
                                  onKeyDown={blockNegativeKeys}
                                  placeholder="-" 
                                  value={displayHome === null ? "" : displayHome} 
                                  onChange={(e) => handleScoreChange(game.id, e.target.value, displayAway?.toString() || "", game.home_score, game.away_score)} 
                                  className="w-12 h-9 bg-neutral-900 border border-white/10 rounded-md text-center text-sm font-black text-white focus:outline-none focus:border-transparent focus:ring-1 transition-all shrink-0" 
                                  style={{ '--tw-ring-color': userColor } as React.CSSProperties} 
                                />
                              </div>
                            </div>

                            {/* Footer do Card (Broadcast) */}
                            {game.broadcast_tag && (
                              <div className="mt-3 flex justify-center scale-90 origin-bottom">
                                <BroadcastBadge tag={game.broadcast_tag} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {Object.keys(draftScores).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md animate-slideUp">
          <div className="bg-neutral-900 border-2 rounded-2xl p-4 flex items-center justify-between gap-4" style={{ borderColor: userColor, boxShadow: `0 10px 40px ${userColor}50` }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: userColor }}>Database Update</span>
              <span className="text-sm font-bold text-white">{Object.keys(draftScores).length} game(s) edited</span>
            </div>
            <button onClick={handleSaveAllScores} disabled={isSaving} className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-black shadow-md transition-colors text-xs sm:text-sm disabled:opacity-50" style={{ backgroundColor: userColor }}>
              {isSaving ? 'Processing...' : 'Broadcast'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}