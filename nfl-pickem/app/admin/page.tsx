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
  
  // CORREÇÃO: Cor dinâmica para o Admin
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

  if (loading) return <LoadingScreen />;

  const weeks = Object.keys(gamesByWeek).sort((a, b) => Number(a) - Number(b));

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-32">
      <Header />
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 mt-4">
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
                  <div className="p-4 bg-black/20 border-t border-white/5 grid gap-3 animate-fadeIn">
                    {gamesByWeek[week].map((game) => {
                      const isUnsaved = !!draftScores[game.id.toString()];
                      const displayAway = draftScores[game.id.toString()]?.away !== undefined ? draftScores[game.id.toString()].away : game.away_score;
                      const displayHome = draftScores[game.id.toString()]?.home !== undefined ? draftScores[game.id.toString()].home : game.home_score;
                      const isFinished = game.status === 'finished';

                      return (
                        <div key={game.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isUnsaved ? 'bg-white/5' : 'border-white/5 bg-black/40'}`} style={isUnsaved ? { borderColor: userColor } : {}}>
                          <div className="flex flex-col w-32 shrink-0">
                            <span className="text-[10px] font-bold text-gray-400">{new Date(game.game_time).toLocaleDateString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                            {game.broadcast_tag && <div className="mt-1"><BroadcastBadge tag={game.broadcast_tag} /></div>}
                          </div>

                          <div className="flex-1 flex items-center justify-center gap-4">
                            <span className="text-sm font-black uppercase text-gray-300 w-12 text-right">{teamsDataMap[game.away_team_id]?.abbr}</span>
                            <input type="number" min="0" placeholder="-" value={displayAway === null ? "" : displayAway} onChange={(e) => handleScoreChange(game.id, displayHome?.toString() || "", e.target.value, game.home_score, game.away_score)} className="w-12 h-12 bg-neutral-900 border border-white/10 rounded-md text-center text-xl font-black text-white focus:outline-none transition-colors" style={{ outlineColor: userColor }} />
                            <span className="text-gray-600 font-bold text-xs">@</span>
                            <input type="number" min="0" placeholder="-" value={displayHome === null ? "" : displayHome} onChange={(e) => handleScoreChange(game.id, e.target.value, displayAway?.toString() || "", game.home_score, game.away_score)} className="w-12 h-12 bg-neutral-900 border border-white/10 rounded-md text-center text-xl font-black text-white focus:outline-none transition-colors" style={{ outlineColor: userColor }} />
                            <span className="text-sm font-black uppercase text-gray-300 w-12 text-left">{teamsDataMap[game.home_team_id]?.abbr}</span>
                          </div>

                          <div className="w-20 text-right shrink-0">
                            {isUnsaved ? <span className="text-[10px] font-black uppercase tracking-widest animate-pulse" style={{ color: userColor }}>Unsaved</span> 
                             : isFinished ? <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Official</span> 
                             : <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Pending</span>}
                          </div>
                        </div>
                      );
                    })}
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