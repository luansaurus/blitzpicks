"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import PlayoffLiveView from '../../components/bracket/PlayoffLiveView';
import { createClient } from '../../utils/supabase/client';
import { getThemeColor } from '../../utils/theme';
import LoadingScreen from '@/components/ui/LoadingScreen';
import BroadcastBadge from '@/components/ui/BroadcastBadge';

// Helper de Estilo (Mesmo motor do GameCard)
const getGameCardStyles = (game: any, conf: string | undefined | null) => {
  let wrapperClass = "transition-all duration-300 rounded-[14px] h-full w-full ";
  let hasGradient = false;

  const isPlayoff = ['WC', 'DR', 'AFCC', 'NFCC', 'CC', 'SB'].includes(game.week);

  if (game.week === 'SB') {
    wrapperClass += "p-[2px] bg-gradient-to-br from-purple-600 via-pink-500 to-amber-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]";
    hasGradient = true;
  } else if (isPlayoff) {
    if (game.week === 'AFCC' || conf === 'AFC') {
      wrapperClass += "p-[1.5px] bg-gradient-to-br from-[#E31837] to-white shadow-[0_0_15px_rgba(227,24,55,0.15)]";
      hasGradient = true;
    } else if (game.week === 'NFCC' || conf === 'NFC') {
      wrapperClass += "p-[1.5px] bg-gradient-to-br from-[#013369] to-white shadow-[0_0_15px_rgba(1,51,105,0.15)]";
      hasGradient = true;
    }
  } else if (game.broadcast_tag) {
    hasGradient = true;
    switch(game.broadcast_tag) {
      case 'TNF': wrapperClass += "p-[1.5px] bg-gradient-to-br from-[#00A8E1] to-white shadow-[0_0_15px_rgba(0,168,225,0.15)]"; break;
      case 'SNF': wrapperClass += "p-[1.5px] bg-gradient-to-br from-[#E2D82C] to-white shadow-[0_0_15px_rgba(226,216,44,0.15)]"; break;
      case 'MNF': wrapperClass += "p-[1.5px] bg-gradient-to-br from-[#CC0000] to-white shadow-[0_0_15px_rgba(204,0,0,0.15)]"; break;
      case 'INT': wrapperClass += "p-[1.5px] bg-gradient-to-br from-indigo-600 to-cyan-400 shadow-[0_0_15px_rgba(79,70,229,0.15)]"; break;
      default: wrapperClass += "p-[1.5px] bg-gradient-to-br from-gray-500 to-white shadow-[0_0_15px_rgba(255,255,255,0.1)]";
    }
  } else {
    wrapperClass += "p-0";
  }

  return { wrapperClass, hasGradient };
};

export default function Results() {
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [standingsByConfAndDiv, setStandingsByConfAndDiv] = useState<Record<string, Record<string, any[]>>>({});
  
  const [isStandingsOpen, setIsStandingsOpen] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  
  const [seasonPhase, setSeasonPhase] = useState<'regular' | 'playoffs'>('regular');
  const [playoffView, setPlayoffView] = useState<'cards' | 'bracket'>('cards');
  
  const [loading, setLoading] = useState(true);
  const [userColor, setUserColor] = useState('#E31837');
  
  const router = useRouter();
  const supabase = createClient();

  const displayColor = getThemeColor(userColor);

  useEffect(() => {
    async function loadResultsData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('favorite_team_id').eq('id', session.user.id).single();
      if (profile?.favorite_team_id) {
        const { data: teamInfo } = await supabase.from('teams').select('primary_color').eq('id', profile.favorite_team_id).single();
        if (teamInfo?.primary_color) setUserColor(teamInfo.primary_color);
      } else if (typeof window !== "undefined") {
         const savedAccent = localStorage.getItem('blitz_accent');
         if (savedAccent) setUserColor(savedAccent);
      }

      const { data: teams } = await supabase.from('teams').select('*');
      const { data: standings } = await supabase.from('standings').select('*');
      
      const tMap: Record<string, any> = {};
      const groupedStandings: Record<string, Record<string, any[]>> = {
        AFC: {},
        NFC: {}
      };

      teams?.forEach(t => {
        const record = standings?.find(s => s.team_id?.toString() === t.id.toString()) || { 
          wins: 0, losses: 0, ties: 0, 
          division_record: '0-0', conference_record: '0-0', cross_conference_record: '0-0' 
        };
        
        const totalGames = record.wins + record.losses + record.ties;
        const pct = totalGames === 0 ? 0 : (record.wins + (record.ties * 0.5)) / totalGames;

        const teamData = { ...t, ...record, pct, conference: t.conference };
        tMap[t.id.toString()] = teamData;

        if (t.conference && t.division) {
          if (!groupedStandings[t.conference]) groupedStandings[t.conference] = {};
          if (!groupedStandings[t.conference][t.division]) groupedStandings[t.conference][t.division] = [];
          
          groupedStandings[t.conference][t.division].push(teamData);
        }
      });

      Object.keys(groupedStandings).forEach(conf => {
        Object.keys(groupedStandings[conf]).forEach(div => {
          groupedStandings[conf][div].sort((a, b) => b.pct - a.pct);
        });
      });

      setTeamsMap(tMap);
      setStandingsByConfAndDiv(groupedStandings);

      const { data: games } = await supabase.from('games').select('*').order('game_time', { ascending: true });

      if (games) {
        const grouped = games.reduce((acc, g) => {
          let w = g.week || '1';
          if (w === 'AFCC' || w === 'NFCC') w = 'CC';
          
          if (!acc[w]) acc[w] = [];
          acc[w].push(g);
          return acc;
        }, {} as Record<string, any[]>);
        
        setGamesByWeek(grouped);

        const regularWeeks = Object.keys(grouped).filter(w => !isNaN(Number(w))).sort((a, b) => Number(a) - Number(b));
        const playoffOrder = ['WC', 'DR', 'CC', 'SB'];
        const playoffWeeks = Object.keys(grouped).filter(w => isNaN(Number(w))).sort((a, b) => playoffOrder.indexOf(a) - playoffOrder.indexOf(b));
        
        const allSortedWeeks = [...regularWeeks, ...playoffWeeks];
        const activeWeek = allSortedWeeks.find(week => !grouped[week].every((g: any) => g.status === 'finished')) || allSortedWeeks[allSortedWeeks.length - 1];
        
        setExpandedWeek(activeWeek);
        
        if (activeWeek && isNaN(Number(activeWeek))) {
          setSeasonPhase('playoffs');
        }
      }

      setLoading(false);
    }
    loadResultsData();
  }, [router, supabase]);

  if (loading) return <LoadingScreen/>;

  const regularWeeks = Object.keys(gamesByWeek).filter(w => !isNaN(Number(w))).sort((a, b) => Number(a) - Number(b));
  const playoffOrder = ['WC', 'DR', 'CC', 'SB'];
  const playoffWeeks = Object.keys(gamesByWeek).filter(w => isNaN(Number(w))).sort((a, b) => playoffOrder.indexOf(a) - playoffOrder.indexOf(b));
  
  const displayWeeks = seasonPhase === 'regular' ? regularWeeks : playoffWeeks;

  const playoffNames: Record<string, string> = {
    'WC': 'Wild Card Weekend',
    'DR': 'Divisional Round',
    'CC': 'Conference Championship',
    'SB': 'Super Bowl'
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-24">
      <Header />
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 mt-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider">
            League<span style={{ color: displayColor, textShadow: `0 0 15px ${displayColor}80, 0 1px 2px rgba(255,255,255,0.2)` }}>Hub</span>
          </h1>
          <p className="text-gray-400 mt-1 font-medium text-xs sm:text-sm">NFL Standings, tiebreakers, and complete season schedule.</p>
        </div>

        {/* NFL Standings (Tabela) */}
        <div className="bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden shadow-lg">
          <button
            onClick={() => setIsStandingsOpen(!isStandingsOpen)}
            className="w-full flex justify-between items-center p-5 bg-neutral-900 hover:bg-neutral-800 transition text-left"
            style={{ borderLeft: `4px solid ${displayColor}` }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🏆</span>
              <span className="font-black text-lg uppercase tracking-widest">NFL Standings</span>
            </div>
            <span className="text-gray-500 text-xs font-bold">{isStandingsOpen ? '▲ Collapse' : '▼ Expand'}</span>
          </button>

          {isStandingsOpen && (
            <div className="p-0 sm:p-6 bg-black/20 border-t border-white/5 animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 sm:gap-8 divide-y divide-white/5 lg:divide-y-0">
                {['AFC', 'NFC'].map(conf => (
                  <div key={conf} className="space-y-6 p-4 sm:p-0">
                    <h2 className="text-2xl font-black italic text-white uppercase tracking-wider border-b border-white/10 pb-2" style={{ color: conf === 'AFC' ? '#ef4444' : '#3b82f6' }}>
                      {conf}
                    </h2>
                    
                    {['North', 'South', 'East', 'West'].map(div => {
                      const teamsInDiv = standingsByConfAndDiv[conf]?.[`${conf} ${div}`] || standingsByConfAndDiv[conf]?.[div];
                      if (!teamsInDiv || teamsInDiv.length === 0) return null;

                      return (
                        <div key={div} className="bg-neutral-900 border border-white/5 rounded-lg overflow-hidden shadow-sm">
                          <div className="bg-black/60 px-4 py-2 border-b border-white/5">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{conf} {div}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm min-w-[500px]">
                              <thead>
                                <tr className="text-[9px] text-gray-500 uppercase tracking-widest bg-black/20">
                                  <th className="px-4 py-2 font-black">Team</th>
                                  <th className="px-2 py-2 text-center">W</th>
                                  <th className="px-2 py-2 text-center">L</th>
                                  <th className="px-2 py-2 text-center">T</th>
                                  <th className="px-3 py-2 text-right">PCT</th>
                                  <th className="px-3 py-2 text-center border-l border-white/5">DIV</th>
                                  <th className="px-3 py-2 text-center">CONF</th>
                                  <th className="px-3 py-2 text-center">NON-CONF</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {teamsInDiv.map(team => (
                                  <tr key={team.id} className="hover:bg-white/[0.02] transition">
                                    <td className="px-4 py-3 flex items-center gap-3">
                                      {team.logo_url && <img src={team.logo_url} alt="" className="w-5 h-5 object-contain" />}
                                      <span className="font-bold uppercase tracking-wider">{team.name}</span>
                                    </td>
                                    <td className="px-2 py-3 text-center font-medium text-white">{team.wins}</td>
                                    <td className="px-2 py-3 text-center font-medium text-white">{team.losses}</td>
                                    <td className="px-2 py-3 text-center font-medium text-white">{team.ties}</td>
                                    <td className="px-3 py-3 text-right font-black text-amber-500">{team.pct.toFixed(3).replace('0.', '.')}</td>
                                    <td className="px-3 py-3 text-center font-medium text-gray-400 border-l border-white/5 text-xs">{team.division_record || '0-0'}</td>
                                    <td className="px-3 py-3 text-center font-medium text-gray-400 text-xs">{team.conference_record || '0-0'}</td>
                                    <td className="px-3 py-3 text-center font-medium text-gray-400 text-xs">{team.cross_conference_record || '0-0'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cabeçalho da Lista do Calendário */}
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-3 gap-4 sm:gap-0">
            <h2 className="text-xl font-black italic uppercase tracking-wider text-white">
              Season Schedule
            </h2>

            {/* Abas Principais */}
            <div className="flex bg-neutral-900 border border-white/10 rounded-xl p-1">
              <button 
                onClick={() => setSeasonPhase('regular')}
                className={`flex-1 sm:px-6 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${seasonPhase === 'regular' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}
                style={seasonPhase === 'regular' ? { color: displayColor } : {}}
              >
                Regular Season
              </button>
              <button 
                onClick={() => setSeasonPhase('playoffs')}
                className={`flex-1 sm:px-6 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${seasonPhase === 'playoffs' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}
                style={seasonPhase === 'playoffs' ? { color: displayColor } : {}}
              >
                Playoffs
              </button>
            </div>
          </div>

          {/* Sub-menu Toggle para Playoffs */}
          {seasonPhase === 'playoffs' && (
            <div className="flex justify-end animate-fadeIn">
              <div className="flex bg-neutral-900 border border-white/10 rounded-lg p-1">
                <button 
                  onClick={() => setPlayoffView('cards')}
                  className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all flex items-center gap-2 ${playoffView === 'cards' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                >
                  🗂️ Cards
                </button>
                <button 
                  onClick={() => setPlayoffView('bracket')}
                  className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all flex items-center gap-2 ${playoffView === 'bracket' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                >
                  🏆 Bracket
                </button>
              </div>
            </div>
          )}
          
          {seasonPhase === 'playoffs' && playoffView === 'bracket' ? (
            <PlayoffLiveView 
              userAccentColor={userColor} 
              userInitialSeeds={{ AFC: {}, NFC: {} }} 
              realResults={{}} 
            />
          ) : (
            displayWeeks.length === 0 ? (
              <div className="bg-neutral-900 border border-white/5 rounded-xl p-8 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                No matchups scheduled for {seasonPhase === 'regular' ? 'the regular season' : 'the playoffs'} yet.
              </div>
            ) : (
              displayWeeks.map(week => {
                const isWeekOpen = expandedWeek === week;
                const weekGames = gamesByWeek[week];
                const isSuperBowlWeek = week === 'SB';

                return (
                  <div key={week} className={`rounded-xl border overflow-hidden transition-all animate-fadeIn ${isSuperBowlWeek && isWeekOpen ? 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]' : 'bg-neutral-900/40 border-white/5 shadow-sm'}`}>
                    <button
                      onClick={() => setExpandedWeek(isWeekOpen ? null : week)}
                      className={`w-full flex justify-between items-center p-4 sm:p-5 transition text-left border-b border-white/5 ${isSuperBowlWeek ? 'bg-gradient-to-r from-purple-900/40 via-black to-amber-900/40 hover:from-purple-900/60' : 'bg-neutral-900/90 hover:bg-neutral-800'}`}
                    >
                      <div className="flex items-center gap-3">
                        {isWeekOpen && !isSuperBowlWeek && (
                          <div className="w-1.5 h-6 rounded-full shadow-lg" style={{ backgroundColor: displayColor, boxShadow: `0 0 10px ${displayColor}80` }}></div>
                        )}
                        {isWeekOpen && isSuperBowlWeek && (
                          <div className="text-xl animate-pulse">🏆</div>
                        )}
                        
                        <span className="font-black text-base uppercase tracking-widest" style={{ color: isWeekOpen && !isSuperBowlWeek ? displayColor : '#ffffff', textShadow: isWeekOpen && !isSuperBowlWeek ? `0 0 15px ${displayColor}80` : 'none' }}>
                          {seasonPhase === 'playoffs' ? (playoffNames[week] || week) : `Week ${week}`}
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
                      <div className={`p-3 sm:p-4 ${isSuperBowlWeek ? 'bg-black/40' : 'bg-black/30'}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                          {weekGames.map(game => {
                            const awayTeam = teamsMap[game.away_team_id?.toString()];
                            const homeTeam = teamsMap[game.home_team_id?.toString()];
                            const isFinished = game.status === 'finished';
                            
                            const gameDate = new Date(game.game_time);
                            const formattedDate = gameDate.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
                            const formattedTime = gameDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                            
                            const awayWon = isFinished && game.away_score > game.home_score;
                            const homeWon = isFinished && game.home_score > game.away_score;

                            // EXTRAINDO A COR E O GRADIENTE:
                            const { wrapperClass, hasGradient } = getGameCardStyles(game, homeTeam?.conference || awayTeam?.conference);

                            return (
                              <div key={game.id} className={wrapperClass}>
                                <div className={`bg-neutral-950 rounded-[12px] p-3 sm:p-4 flex flex-col gap-3 h-full transition-colors ${hasGradient ? '' : 'border border-white/10 hover:border-white/20 shadow-sm'}`}>
                                  
                                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none truncate">
                                        {formattedDate}
                                      </span>
                                      {/* FLEXBOX FIX: shrink-0 origin-left e margin negativa ajudam a ignorar o scale */}
                                      {game.broadcast_tag && (
                                        <div className="shrink-0 transform scale-[0.70] origin-left -mr-5 flex items-center">
                                          <BroadcastBadge tag={game.broadcast_tag} />
                                        </div>
                                      )}
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ml-2 ${isFinished ? 'text-green-500' : 'text-neutral-500'}`}>
                                      {isFinished ? 'Final' : formattedTime}
                                    </span>
                                  </div>

                                  <div className="flex flex-col gap-2">
                                    <div className={`flex items-center justify-between ${isFinished && !awayWon ? 'opacity-40' : 'opacity-100'}`}>
                                      <div className="flex items-center gap-2">
                                        {awayTeam?.logo_url ? <img src={awayTeam.logo_url} className="w-6 h-6 object-contain" alt="" /> : <div className="w-6 h-6 bg-white/5 rounded-full" />}
                                        <span className="font-black text-sm text-white uppercase">{awayTeam?.abbreviation || 'AWAY'}</span>
                                      </div>
                                      <span className={`font-black text-lg ${isFinished && awayWon ? 'text-white' : (isFinished ? 'text-gray-400' : 'text-neutral-700')}`}>
                                        {isFinished ? game.away_score : '-'}
                                      </span>
                                    </div>

                                    <div className={`flex items-center justify-between ${isFinished && !homeWon ? 'opacity-40' : 'opacity-100'}`}>
                                      <div className="flex items-center gap-2">
                                        {homeTeam?.logo_url ? <img src={homeTeam.logo_url} className="w-6 h-6 object-contain" alt="" /> : <div className="w-6 h-6 bg-white/5 rounded-full" />}
                                        <span className="font-black text-sm text-white uppercase">{homeTeam?.abbreviation || 'HOME'}</span>
                                      </div>
                                      <span className={`font-black text-lg ${isFinished && homeWon ? 'text-white' : (isFinished ? 'text-gray-400' : 'text-neutral-700')}`}>
                                        {isFinished ? game.home_score : '-'}
                                      </span>
                                    </div>
                                  </div>

                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )
          )} 
        </div>
      </div>
    </main>
  );
}