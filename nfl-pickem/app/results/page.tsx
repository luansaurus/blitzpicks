"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import PlayoffLiveView from '../../components/bracket/PlayoffLiveView';
import GameCard from '../../components/scoreboard/GameCard';
import TeamStatsViewer from '../../components/scoreboard/TeamStatsViewer'; 
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { getPlayoffSeeds } from '@/utils/playoffs';
import { Trophy, LayoutGrid, Calendar, BarChart2 } from 'lucide-react';
import LeagueLeadersViewer from '@/components/scoreboard/LeagueLeadersViewer';

// Lógica de Luminância para garantir cores legíveis
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

export default function Results() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'standings' | 'stats'>('schedule');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [allTeamsList, setAllTeamsList] = useState<any[]>([]);

  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [standingsByConfAndDiv, setStandingsByConfAndDiv] = useState<Record<string, Record<string, any[]>>>({});
  
  const [computedSeeds, setComputedSeeds] = useState<{ AFC: Record<number, any>; NFC: Record<number, any> }>({ AFC: {}, NFC: {} });
  
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [currentActiveWeek, setCurrentActiveWeek] = useState<string | null>(null); 
  
  const [seasonPhase, setSeasonPhase] = useState<'regular' | 'playoffs'>('regular');
  const [playoffView, setPlayoffView] = useState<'cards' | 'bracket'>('cards');
  
  const [loading, setLoading] = useState(true);
  
  // Cores dinâmicas
  const [userColor, setUserColor] = useState('#E31837');
  const [ambientPrimary, setAmbientPrimary] = useState('#013369');
  const [ambientSecondary, setAmbientSecondary] = useState('#E31837');
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadResultsData() {
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

      const { data: teams } = await supabase.from('teams').select('*').order('name');
      const { data: standings } = await supabase.from('standings').select('*');
      
      setAllTeamsList(teams || []);

      const tMap: Record<string, any> = {};
      const groupedStandings: Record<string, Record<string, any[]>> = { AFC: {}, NFC: {} };

      if (teams && standings) {
        const generatedSeeds = await getPlayoffSeeds(teams, standings);
        setComputedSeeds(generatedSeeds);
      }

      teams?.forEach(t => {
        const record = standings?.find(s => s.team_id?.toString() === t.id.toString()) || { 
          wins: 0, losses: 0, ties: 0, division_record: '0-0', conference_record: '0-0', cross_conference_record: '0-0' 
        };
        const totalGames = record.wins + record.losses + record.ties;
        const pct = totalGames === 0 ? 0 : (record.wins + (record.ties * 0.5)) / totalGames;
        const recordStr = `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ''}`;
        const teamData = { ...t, ...record, pct, conference: t.conference };
        
        tMap[t.id.toString()] = { 
          name: t.name, 
          abbr: t.abbreviation, 
          color: getBestColor(t.primary_color, t.secondary_color), 
          logo: t.logo_url, 
          record: recordStr 
        };

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

      const { data: games } = await supabase.from('games').select('*, stadium(name, city)').order('game_time', { ascending: true });

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
        
        setCurrentActiveWeek(activeWeek);
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

  const playoffNames: Record<string, string> = { 'WC': 'Wild Card Weekend', 'DR': 'Divisional Round', 'CC': 'Conference Championship', 'SB': 'Super Bowl' };

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans pb-32 relative overflow-hidden">
      
      {/* Luzes de Atmosfera */}
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
        
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8 mt-4">
          
          <div className="text-center mb-10">
            {/* FONTE REDUZIDA: text-5xl/7xl -> text-5xl/6xl */}
            <h1 className="font-jersey text-5xl sm:text-5xl uppercase tracking-widest text-white mb-2">
              SEASON<span style={{ color: userColor, textShadow: `0 0 15px ${userColor}80` }}>HUB</span>
            </h1>
            <p className="font-sans text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Official NFL data, complete schedule, and league metrics.</p>
          </div>

          {/* Nav Pills - Glassmorphism */}
          <div className="flex bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 w-full max-w-lg mx-auto shadow-2xl mb-8">
            <button 
              onClick={() => setActiveTab('schedule')} 
              className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'schedule' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
              style={activeTab === 'schedule' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
            >
              <Calendar size={16} /> Schedule
            </button>
            <button 
              onClick={() => setActiveTab('standings')} 
              className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'standings' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
              style={activeTab === 'standings' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
            >
              <Trophy size={16} /> Standings
            </button>
            <button 
              onClick={() => setActiveTab('stats')} 
              className={`flex-1 px-4 py-3 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'stats' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} 
              style={activeTab === 'stats' ? { color: userColor, boxShadow: `inset 0 -4px 0 ${userColor}` } : {}}
            >
              <BarChart2 size={16} /> Team Stats
            </button>
          </div>

          {/* ================= ABA: SCHEDULE ================= */}
          {activeTab === 'schedule' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-4 sm:gap-0">
                {/* FONTE REDUZIDA: text-2xl/5xl -> text-2xl/4xl */}
                <h2 className="font-jersey text-2xl sm:text-2xl uppercase tracking-widest text-white drop-shadow-md">SEASON MATCHES</h2>
                
                <div className="flex bg-black/60 border border-white/10 rounded-xl p-1.5 shadow-inner">
                  <button 
                    onClick={() => setSeasonPhase('regular')} 
                    className={`flex-1 sm:px-6 py-2.5 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${seasonPhase === 'regular' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'}`} 
                    style={seasonPhase === 'regular' ? { color: userColor } : {}}
                  >
                    Regular
                  </button>
                  <button 
                    onClick={() => setSeasonPhase('playoffs')} 
                    className={`flex-1 sm:px-6 py-2.5 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${seasonPhase === 'playoffs' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white hover:bg-white/[0.02]'}`} 
                    style={seasonPhase === 'playoffs' ? { color: userColor } : {}}
                  >
                    Playoffs
                  </button>
                </div>
              </div>

              {seasonPhase === 'playoffs' && (
                <div className="flex justify-end animate-fadeIn">
                  <div className="flex bg-black/60 border border-white/10 rounded-xl p-1.5 shadow-inner">
                    <button 
                      onClick={() => setPlayoffView('cards')} 
                      className={`px-4 py-2 font-sans text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${playoffView === 'cards' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                      <LayoutGrid size={14} /> Cards
                    </button>
                    <button 
                      onClick={() => setPlayoffView('bracket')} 
                      className={`px-4 py-2 font-sans text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${playoffView === 'bracket' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                      <Trophy size={14} /> Bracket
                    </button>
                  </div>
                </div>
              )}
              
              {seasonPhase === 'playoffs' && playoffView === 'bracket' ? (
                <div className="bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-4">
                  <PlayoffLiveView userAccentColor={userColor} userInitialSeeds={computedSeeds} realResults={{}} />
                </div>
              ) : (
                displayWeeks.length === 0 ? (
                  <div className="bg-black/60 backdrop-blur-md border border-white/5 rounded-2xl p-10 text-center font-sans text-[10px] sm:text-xs text-gray-500 font-black uppercase tracking-widest shadow-inner">
                    No matchups scheduled.
                  </div>
                ) : (
                  displayWeeks.map(week => {
                    const isWeekOpen = expandedWeek === week;
                    const weekGames = gamesByWeek[week];
                    const isSuperBowlWeek = week === 'SB';
                    const isCurrentWeek = week === currentActiveWeek;
                    const isFinished = weekGames.length > 0 && weekGames.every(g => g.status === 'finished');

                    return (
                      <div key={week} className={`rounded-2xl border overflow-hidden transition-all shadow-lg ${isSuperBowlWeek && isWeekOpen ? 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]' : isWeekOpen ? 'border-white/10 shadow-xl' : 'border-white/5 shadow-sm bg-black/40'}`}>
                        <button 
                          onClick={() => setExpandedWeek(isWeekOpen ? null : week)} 
                          className={`w-full flex justify-between items-center p-4 sm:p-5 transition-colors text-left border-b border-transparent ${isSuperBowlWeek ? 'bg-gradient-to-r from-purple-900/40 via-black to-amber-900/40 hover:from-purple-900/60' : 'bg-black/60 hover:bg-white/[0.02]'}`}
                          style={isWeekOpen && !isSuperBowlWeek ? { borderBottomColor: 'rgba(255,255,255,0.05)' } : {}}
                        >
                          <div className="flex items-center gap-3">
                            {isWeekOpen && !isSuperBowlWeek && <div className="w-1.5 h-6 rounded-full shadow-lg" style={{ backgroundColor: userColor, boxShadow: `0 0 10px ${userColor}80` }}></div>}
                            {isWeekOpen && isSuperBowlWeek && <Trophy size={20} className="animate-pulse text-amber-400 drop-shadow-md" />}
                            
                            {/* FONTE REDUZIDA: text-xl/3xl -> text-xl/2xl */}
                            <span className={`font-jersey text-xl sm:text-xl uppercase tracking-widest pt-1 leading-none ${isWeekOpen && !isSuperBowlWeek ? 'text-white' : isSuperBowlWeek ? 'text-amber-400' : 'text-gray-400'}`} style={isWeekOpen && !isSuperBowlWeek ? { color: userColor, textShadow: `0 0 15px ${userColor}80` } : {}}>
                              {seasonPhase === 'playoffs' ? (playoffNames[week] || week) : `Week ${week}`}
                            </span>
                            {!isSuperBowlWeek && (
                              isCurrentWeek ? <span className="hidden sm:inline-flex items-center text-[9px] uppercase font-black px-2 py-0.5 bg-red-500/10 text-red-500 rounded border border-red-500/30 tracking-widest animate-pulse ml-2 shadow-inner">Current Week</span> 
                              : isFinished ? <span className="hidden sm:inline-flex items-center text-[9px] uppercase font-black px-2 py-0.5 bg-white/5 text-gray-500 rounded border border-white/5 tracking-widest ml-2">Finished</span> 
                              : <span className="hidden sm:inline-flex items-center text-[9px] uppercase font-black px-2 py-0.5 bg-white/5 text-gray-400 rounded border border-white/5 tracking-widest ml-2">Upcoming</span>
                            )}
                          </div>
                          <span className="text-gray-500 text-xs font-bold shrink-0">{isWeekOpen ? '▲ Collapse' : '▼ Expand'}</span>
                        </button>

                        {isWeekOpen && (
                          <div className={`p-4 sm:p-6 ${isSuperBowlWeek ? 'bg-black/40' : 'bg-black/20'} animate-fadeIn shadow-inner`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                              {weekGames.map(game => (
                                <GameCard 
                                  key={game.id} 
                                  game={game} 
                                  userTeamColor={userColor} 
                                  homeTeam={teamsMap[game.home_team_id?.toString()] || { name: 'Home', abbr: 'HOME', color: '#171717' }} 
                                  awayTeam={teamsMap[game.away_team_id?.toString()] || { name: 'Away', abbr: 'AWAY', color: '#171717' }} 
                                  hidePicks={true}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              )} 
            </div>
          )}

          {/* ================= ABA: STANDINGS ================= */}
          {activeTab === 'standings' && (
            <div className="animate-fadeIn space-y-8">
              {/* FONTE REDUZIDA: text-2xl/5xl -> text-2xl/4xl */}
              <h2 className="font-jersey text-2xl sm:text-2xl uppercase tracking-widest text-white border-b border-white/10 pb-4 drop-shadow-md">OFFICIAL STANDINGS</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {['AFC', 'NFC'].map(conf => (
                  <div key={conf} className="space-y-6">
                    {/* FONTE REDUZIDA: text-2xl/5xl -> text-2xl/4xl */}
                    <h2 className="font-jersey text-2xl sm:text-2xl text-white uppercase tracking-widest border-b border-white/10 pb-3" style={{ color: conf === 'AFC' ? '#ef4444' : '#3b82f6', textShadow: `0 0 15px ${conf === 'AFC' ? '#ef444460' : '#3b82f660'}` }}>{conf}</h2>
                    {['North', 'South', 'East', 'West'].map(div => {
                      const teamsInDiv = standingsByConfAndDiv[conf]?.[`${conf} ${div}`] || standingsByConfAndDiv[conf]?.[div];
                      if (!teamsInDiv || teamsInDiv.length === 0) return null;
                      return (
                        <div key={div} className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                          <div className="bg-black/80 px-4 py-3 border-b border-white/10 flex items-center shadow-inner">
                            <span className="font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400">{conf} {div}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left whitespace-nowrap min-w-[500px]">
                              <thead>
                                <tr className="font-sans text-[9px] text-gray-500 uppercase tracking-widest bg-black/40 border-b border-white/5">
                                  <th className="px-5 py-3 font-black">Team</th>
                                  <th className="px-3 py-3 text-center">W</th><th className="px-3 py-3 text-center">L</th><th className="px-3 py-3 text-center">T</th>
                                  <th className="px-4 py-3 text-right">PCT</th>
                                  <th className="px-4 py-3 text-center border-l border-white/10">DIV</th>
                                  <th className="px-4 py-3 text-center">CONF</th>
                                  <th className="px-4 py-3 text-center">NON-CONF</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {teamsInDiv.map(team => (
                                  <tr key={team.id} className="hover:bg-white/[0.03] transition-colors group">
                                    <td className="px-5 py-3 flex items-center gap-3">
                                      {team.logo_url && <img src={team.logo_url} alt="" className="w-6 h-6 object-contain drop-shadow-md" />}
                                      <span className="font-sport font-bold text-sm sm:text-base uppercase tracking-wider text-gray-300 group-hover:text-white transition-colors">{team.name}</span>
                                    </td>
                                    {/* FONTE REDUZIDA NA TABELA: text-xl/2xl -> text-lg/xl */}
                                    <td className="px-3 py-3 text-center font-jersey text-lg sm:text-xl leading-none pt-2 text-white">{team.wins}</td>
                                    <td className="px-3 py-3 text-center font-jersey text-lg sm:text-xl leading-none pt-2 text-gray-400">{team.losses}</td>
                                    <td className="px-3 py-3 text-center font-jersey text-lg sm:text-xl leading-none pt-2 text-gray-600">{team.ties}</td>
                                    <td className="px-4 py-3 text-right font-jersey text-lg sm:text-xl leading-none pt-2 text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">{team.pct.toFixed(3).replace('0.', '.')}</td>
                                    <td className="px-4 py-3 text-center font-sport font-bold text-gray-500 border-l border-white/10 text-xs tracking-wider">{team.division_record || '0-0'}</td>
                                    <td className="px-4 py-3 text-center font-sport font-bold text-gray-500 text-xs tracking-wider">{team.conference_record || '0-0'}</td>
                                    <td className="px-4 py-3 text-center font-sport font-bold text-gray-500 text-xs tracking-wider">{team.cross_conference_record || '0-0'}</td>
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

          {/* ================= ABA: TEAM STATS ================= */}
          {activeTab === 'stats' && (
            <div className="animate-fadeIn space-y-8">
              {/* FONTE REDUZIDA: text-2xl/5xl -> text-2xl/4xl */}
              <h2 className="font-jersey text-2xl sm:text-2xl uppercase tracking-widest text-white border-b border-white/10 pb-4 drop-shadow-md">TEAM METRICS & LEADERS</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                 
                 <div className="lg:col-span-2 flex justify-center mb-4">
                   <button 
                      onClick={() => setSelectedTeamId('NFL')}
                      className={`shrink-0 rounded-2xl px-8 py-4 border transition-all flex items-center justify-center gap-3 shadow-xl hover:scale-105 ${selectedTeamId === 'NFL' || !selectedTeamId ? 'border-amber-500 bg-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.3)]' : 'border-white/10 bg-black/60 backdrop-blur-md hover:bg-white/5'}`}
                    >
                      <Trophy size={20} className={selectedTeamId === 'NFL' || !selectedTeamId ? 'text-amber-400 drop-shadow-md' : 'text-gray-500'} />
                      <span className={`font-sport font-bold text-sm sm:text-base uppercase tracking-wider leading-none pt-1 ${selectedTeamId === 'NFL' || !selectedTeamId ? 'text-amber-400 drop-shadow-md' : 'text-gray-400'}`}>NFL GLOBAL LEADERS</span>
                    </button>
                 </div>

                 {['AFC', 'NFC'].map(conf => (
                   <div key={conf} className="space-y-6">
                      {/* FONTE REDUZIDA: text-2xl/5xl -> text-2xl/4xl */}
                      <h3 className="font-jersey text-2xl sm:text-2xl text-white uppercase tracking-widest border-b border-white/10 pb-3" style={{ color: conf === 'AFC' ? '#ef4444' : '#3b82f6', textShadow: `0 0 15px ${conf === 'AFC' ? '#ef444460' : '#3b82f660'}` }}>{conf}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                         {['North', 'South', 'East', 'West'].map(div => {
                            const divTeams = allTeamsList.filter(t => t.conference === conf && t.division === div && t.abbreviation !== 'NFL' && t.abbreviation !== 'TBD');
                            if (divTeams.length === 0) return null;
                            
                            return (
                               <div key={div} className="flex flex-col gap-3 bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg">
                                  <span className="font-sans text-[10px] font-black text-gray-500 uppercase tracking-widest text-center shadow-inner py-1 rounded bg-black/40">{conf} {div}</span>
                                  
                                  <div className="grid grid-cols-2 gap-3 sm:gap-4 place-items-center w-fit mx-auto">
                                     {divTeams.map(team => {
                                       const isSelected = selectedTeamId === team.id.toString();
                                       const tColor = getBestColor(team.primary_color, team.secondary_color);
                                       return (
                                        <button 
                                          key={team.id}
                                          onClick={() => setSelectedTeamId(team.id.toString())}
                                          className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full p-2 border transition-all flex items-center justify-center ${isSelected ? 'border-white bg-black scale-110 shadow-2xl z-10' : 'border-white/5 bg-black/60 hover:bg-black/80 hover:scale-105 opacity-60 hover:opacity-100'}`}
                                          style={isSelected ? { borderColor: tColor, boxShadow: `0 0 20px ${tColor}60` } : {}}
                                        >
                                          <img src={team.logo_url} alt={team.abbreviation} className="w-full h-full object-contain drop-shadow-md" title={team.name} />
                                        </button>
                                       );
                                     })}
                                  </div>
                                  
                               </div>
                            )
                         })}
                      </div>
                   </div>
                 ))}
              </div>

              {selectedTeamId === 'NFL' || !selectedTeamId ? (
                 <LeagueLeadersViewer teamsDataMap={teamsMap} />
              ) : selectedTeamId ? (
                <div className="mt-10 pt-8 border-t border-white/10 animate-fadeIn">
                  <TeamStatsViewer teamId={selectedTeamId} teamInfo={allTeamsList.find(t => t.id.toString() === selectedTeamId)} />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}