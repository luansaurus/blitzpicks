"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import BroadcastBadge from '@/components/ui/BroadcastBadge';
import { CheckCircle2, XCircle, RefreshCw, Zap } from 'lucide-react';
import { getBestColor } from '@/lib/color';

export default function AdminPage() {
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  const [teamsDataMap, setTeamsDataMap] = useState<Record<string, any>>({});
  const [draftScores, setDraftScores] = useState<Record<string, { home: number | null, away: number | null }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
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
  
  const router = useRouter();
  const supabase = createClient();

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    async function checkAdminAndLoadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: profile } = await supabase.from('profiles').select('is_admin, favorite_team_id').eq('id', session.user.id).single();
      if (!profile?.is_admin) { router.push('/dashboard'); return; }

      const { data: teams } = await supabase.from('teams').select('*');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => { 
        tMap[t.id] = { 
          name: t.name, 
          abbr: t.abbreviation, 
          logo: t.logo_url,
          color: getBestColor(t.primary_color || '', t.secondary_color || '')
        }; 
      });
      setTeamsDataMap(tMap);

      if (profile.favorite_team_id && teams) {
        const tInfo = teams.find(t => t.id === profile.favorite_team_id);
        if (tInfo) {
          setUserColor(getBestColor(tInfo.primary_color || '', tInfo.secondary_color || ''));
          setAmbientPrimary(tInfo.primary_color || '#013369');
          setAmbientSecondary(tInfo.secondary_color || '#E31837');
        }
      } else if (typeof window !== "undefined") {
         const savedAccent = localStorage.getItem('blitz_accent');
         if (savedAccent) setUserColor(savedAccent);
      }

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
        setExpandedWeek(activeWeek || null);
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
    let hasNewFinishedGame = false;

    const updates = Object.entries(draftScores).map(([gameId, scores]) => {
      const isComplete = scores.home !== null && scores.away !== null;
      
      const payload: any = { 
        home_score: scores.home, 
        away_score: scores.away 
      };

      if (isComplete) {
        payload.status = 'finished';
        payload.clock = 'FINAL';
        hasNewFinishedGame = true;
      } else if (scores.home !== null || scores.away !== null) {
        payload.status = 'in_progress';
      } else {
        payload.status = 'pending';
        payload.clock = null;
      }

      return supabase.from('games').update(payload).eq('id', parseInt(gameId));
    });

    try {
      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error !== null);
      if (hasError) throw new Error("Falha ao atualizar.");

      if (hasNewFinishedGame) {
        await fetch('/api/recalculate', { method: 'POST' });
      }

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
      
      if (hasNewFinishedGame) {
        showToast("Match finished successfully! Points and Standings locked.", "success");
      } else {
        showToast("Live scores updated.", "info");
      }

    } catch (err) {
      showToast("Error saving scores. Check formats.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const forceApiSync = async () => {
    setIsSyncing(true);
    showToast("Requesting ESPN data...", "info");
    
    try {
      const response = await fetch('/api/admin/sync-games', { method: 'POST' }); 
      const data = await response.json();
      if(data.success || response.ok) {
        window.location.reload(); 
      } else {
        showToast("Auto-sync failed to respond.", "error");
        setIsSyncing(false);
      }
    } catch (err) {
      showToast("Connection to API Server lost.", "error");
      setIsSyncing(false);
    } 
  };

  const blockNegativeKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === ',' || e.key === '.') e.preventDefault();
  };

  if (loading) return <LoadingScreen />;

  const weeks = Object.keys(gamesByWeek).sort((a, b) => Number(a) - Number(b));

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans pb-40 sm:pb-48 relative overflow-hidden">
      
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

      <Header />
      
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[99999] animate-slideDown">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-xl border ${
            toast.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981]' : 
            toast.type === 'error' ? 'bg-[#ef4444]/20 border-[#ef4444]/50 text-[#ef4444]' : 
            'bg-white/10 border-white/20 text-white'
          }`}>
            <span className="text-lg">
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : toast.type === 'error' ? <XCircle size={18} /> : <RefreshCw size={18} />}
            </span>
            <span className="font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest">
              {toast.message}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 mt-4 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="font-jersey text-4xl sm:text-5xl uppercase tracking-widest text-white mb-1 drop-shadow-md">
              CONTROL <span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80` }}>ROOM</span>
            </h1>
            <p className="font-sans text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Atualize os resultados oficiais e acompanhe as transmissões.</p>
          </div>
          
          <button 
            onClick={forceApiSync}
            disabled={isSyncing}
            className={`relative overflow-hidden px-6 py-3.5 rounded-xl font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-xl border border-white/20 group ${isSyncing ? 'opacity-70 cursor-wait' : 'hover:scale-105'}`}
            style={{ backgroundColor: `${userColor}20`, color: userColor, boxShadow: `0 0 20px ${userColor}30` }}
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            {isSyncing ? 'Syncing...' : <span className="inline-flex items-center gap-2"><Zap size={14} /> Force API Sync</span>}
          </button>
        </div>

        <div className="space-y-4">
          {weeks.map(week => {
            const isOpen = expandedWeek === week;
            return (
              <div key={week} className={`rounded-2xl border overflow-hidden transition-all shadow-lg ${isOpen ? 'bg-black/60 border-white/10 backdrop-blur-xl' : 'border-white/5 bg-black/40 backdrop-blur-md'}`}>
                <button 
                  onClick={() => setExpandedWeek(isOpen ? null : week)} 
                  className="w-full flex justify-between items-center p-4 sm:p-5 bg-black/80 hover:bg-white/[0.02] transition-colors text-left border-b border-white/5"
                  style={isOpen ? { borderBottomColor: 'rgba(255,255,255,0.05)' } : {}}
                >
                  <span className="font-jersey text-2xl sm:text-3xl uppercase tracking-widest pt-1" style={{ color: isOpen ? userColor : '#ffffff', textShadow: isOpen ? `0 0 10px ${userColor}80` : 'none' }}>Week {week}</span>
                  <span className="text-gray-500 font-bold text-xs uppercase tracking-widest shrink-0">{isOpen ? '▲ Collapse' : '▼ Expand'}</span>
                </button>

                {isOpen && (
                  <div className="p-4 sm:p-5 bg-black/20 animate-fadeIn shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {gamesByWeek[week].map((game) => {
                        const isUnsaved = !!draftScores[game.id.toString()];
                        const displayAway = draftScores[game.id.toString()]?.away !== undefined ? draftScores[game.id.toString()].away : game.away_score;
                        const displayHome = draftScores[game.id.toString()]?.home !== undefined ? draftScores[game.id.toString()].home : game.home_score;
                        
                        const isFinished = game.status === 'finished';
                        const isLive = game.status === 'in_progress';

                        const awayTeam = teamsDataMap[game.away_team_id];
                        const homeTeam = teamsDataMap[game.home_team_id];

                        return (
                          <div 
                            key={game.id} 
                            className={`flex flex-col p-3.5 sm:p-4 rounded-2xl border transition-all shadow-xl ${isUnsaved ? 'bg-white/10' : 'border-white/10 bg-black/60 backdrop-blur-md'}`} 
                            style={isUnsaved ? { borderColor: userColor, boxShadow: `0 0 20px ${userColor}40` } : {}}
                          >
                            <div className="flex justify-between items-start mb-3 pb-2 border-b border-white/5">
                              <div className="flex flex-col">
                                <span className="font-sans text-[9px] font-black text-gray-400 uppercase tracking-widest leading-tight">
                                  {new Date(game.game_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                </span>
                                <span className="font-sans text-[9px] font-bold text-gray-500 tracking-widest">
                                  {new Date(game.game_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                {isUnsaved ? (
                                  <span className="font-sans text-[9px] font-black uppercase tracking-widest animate-pulse" style={{ color: userColor }}>Unsaved</span> 
                                ) : isFinished ? (
                                  <span className="font-sans text-[9px] font-black uppercase tracking-widest text-green-500 drop-shadow-md">FINAL</span> 
                                ) : isLive ? (
                                  <span className="font-sans text-[9px] font-black uppercase tracking-widest text-red-500 animate-pulse">LIVE</span> 
                                ) : (
                                  <span className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-600">Pending</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2.5 grow justify-center">
                              <div className="flex items-center justify-between bg-black/60 p-2 sm:p-2.5 rounded-xl border border-white/5 shadow-inner">
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  {awayTeam?.logo ? <img src={awayTeam.logo} alt="" className="w-6 h-6 object-contain shrink-0 drop-shadow-sm" /> : <div className="w-6 h-6 bg-white/5 rounded-full shrink-0" />}
                                  <span className="font-sport font-bold text-xs uppercase text-gray-300 truncate tracking-wider">{awayTeam?.abbr || 'AWAY'}</span>
                                </div>
                                <input 
                                  type="number" 
                                  min="0" 
                                  onKeyDown={blockNegativeKeys}
                                  placeholder="-" 
                                  value={displayAway === null ? "" : displayAway} 
                                  onChange={(e) => handleScoreChange(game.id, displayHome?.toString() || "", e.target.value, game.home_score, game.away_score)} 
                                  className="w-14 h-10 bg-black/80 border border-white/20 rounded-xl text-center font-jersey text-xl text-white focus:outline-none focus:border-white transition-all shrink-0 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>

                              <div className="flex items-center justify-between bg-black/60 p-2 sm:p-2.5 rounded-xl border border-white/5 shadow-inner">
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  {homeTeam?.logo ? <img src={homeTeam.logo} alt="" className="w-6 h-6 object-contain shrink-0 drop-shadow-sm" /> : <div className="w-6 h-6 bg-white/5 rounded-full shrink-0" />}
                                  <span className="font-sport font-bold text-xs uppercase text-gray-300 truncate tracking-wider">{homeTeam?.abbr || 'HOME'}</span>
                                </div>
                                <input 
                                  type="number" 
                                  min="0" 
                                  onKeyDown={blockNegativeKeys}
                                  placeholder="-" 
                                  value={displayHome === null ? "" : displayHome} 
                                  onChange={(e) => handleScoreChange(game.id, e.target.value, displayAway?.toString() || "", game.home_score, game.away_score)} 
                                  className="w-14 h-10 bg-black/80 border border-white/20 rounded-xl text-center font-jersey text-xl text-white focus:outline-none focus:border-white transition-all shrink-0 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>

                              {game.broadcast_tag && (
                                <div className="mt-3 flex justify-center scale-90 origin-bottom">
                                  <BroadcastBadge tag={game.broadcast_tag} />
                                </div>
                              )}
                            </div>
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
        <div 
          className="fixed bottom-6 sm:bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-md animate-slideUp"
          style={{ zIndex: 999999 }}
        >
          <div 
            className="bg-black/95 backdrop-blur-3xl border-t-4 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all duration-300 shadow-[0_25px_60px_rgba(0,0,0,0.9)]" 
            style={{ borderTopColor: userColor }}
          >
            <div className="flex flex-col gap-1 pl-2">
              <span className="font-sans text-[9px] sm:text-[10px] font-black uppercase tracking-widest" style={{ color: userColor, textShadow: `0 0 10px ${userColor}80` }}>
                Database Update
              </span>
              <span className="font-sport font-bold text-base sm:text-xl text-white uppercase tracking-wider drop-shadow-md">
                {Object.keys(draftScores).length} game(s) edited
              </span>
            </div>
            <button 
              onClick={handleSaveAllScores} 
              disabled={isSaving} 
              className="px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl font-sport font-bold text-base sm:text-lg uppercase tracking-wider transition-all shadow-xl hover:scale-105 disabled:opacity-50 text-black flex items-center justify-center min-w-[110px] sm:min-w-[120px]" 
              style={{ backgroundColor: userColor, boxShadow: `0 0 20px ${userColor}50` }}
            >
              {isSaving ? 'PROCESSING...' : 'LOCK RESULTS'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}