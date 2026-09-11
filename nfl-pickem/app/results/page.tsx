"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/header';
import PlayoffLiveView from '../../components/bracket/PlayoffLiveView';
import GameCard from '../../components/scoreboard/GameCard';
import { createClient } from '../../utils/supabase/client';
import { getThemeColor } from '../../utils/theme';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { getPlayoffSeeds } from '@/utils/playoffs';
import { Trophy, LayoutGrid } from 'lucide-react';

export default function Results () {
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, any[]>>({});
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [standingsByConfAndDiv, setStandingsByConfAndDiv] = useState<Record<string, Record<string, any[]>>>({});
  
  const [computedSeeds, setComputedSeeds] = useState<{ AFC: Record<number, any>; NFC: Record<number, any> }>({ AFC: {}, NFC: {} });
  
  const [isStandingsOpen, setIsStandingsOpen] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [currentActiveWeek, setCurrentActiveWeek] = useState<string | null>(null); 
  
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
      const { data: standings } = await supabase.from('standings').select('*');
      
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
        
        tMap[t.id.toString()] = { name: t.name, abbr: t.abbreviation, color: t.primary_color, logo: t.logo_url, record: recordStr };

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
    <main className="min-h-screen bg-neutral-950 text-white font-sans pb-24">
      <Header />
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 mt-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-wider">
            Season<span style={{ color: displayColor, textShadow: `0 0 15px ${displayColor}80, 0 1px 2px rgba(255,255,255,0.2)` }}>Hub</span>
          </h1>
          <p className="text-gray-400 mt-1 font-medium text-xs sm:text-sm">NFL Standings, tiebreakers, and complete season schedule.</p>
        </div>

        <div className="bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden shadow-lg">
          <button onClick={() => setIsStandingsOpen(!isStandingsOpen)} className="w-full flex justify-between items-center p-5 bg-neutral-900 hover:bg-neutral-800 transition text-left" style={{ borderLeft: `4px solid ${displayColor}` }}>
            <div className="flex items-center gap-3">
              <Trophy size={20} />
              <span className="font-black text-lg uppercase tracking-widest">NFL Standings</span>
            </div>
            <span className="text-gray-500 text-xs font-bold">{isStandingsOpen ? '▲ Collapse' : '▼ Expand'}</span>
          </button>

          {isStandingsOpen && (
            <div className="p-0 sm:p-6 bg-black/20 border-t border-white/5 animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 sm:gap-8 divide-y divide-white/5 lg:divide-y-0">
                {['AFC', 'NFC'].map(conf => (
                  <div key={conf} className="space-y-6 p-4 sm:p-0">
                    <h2 className="text-2xl font-black italic text-white uppercase tracking-wider border-b border-white/10 pb-2" style={{ color: conf === 'AFC' ? '#ef4444' : '#3b82f6' }}>{conf}</h2>
                    {['North', 'South', 'East', 'West'].map(div => {
                      const teamsInDiv = standingsByConfAndDiv[conf]?.[`${conf} ${div}`] || standingsByConfAndDiv[conf]?.[div];
                      if (!teamsInDiv || teamsInDiv.length === 0) return null;
                      return (
                        <div key={div} className="bg-neutral-900 border border-white/5 rounded-lg overflow-hidden shadow-sm">
                          <div className="bg-black/60 px-4 py-2 border-b border-white/5"><span className="text-xs font-bold uppercase tracking-widest text-gray-400">{conf} {div}</span></div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm min-w-[500px]">
                              <thead>
                                <tr className="text-[9px] text-gray-500 uppercase tracking-widest bg-black/20">
                                  <th className="px-4 py-2 font-black">Team</th><th className="px-2 py-2 text-center">W</th><th className="px-2 py-2 text-center">L</th><th className="px-2 py-2 text-center">T</th>
                                  <th className="px-3 py-2 text-right">PCT</th><th className="px-3 py-2 text-center border-l border-white/5">DIV</th><th className="px-3 py-2 text-center">CONF</th><th className="px-3 py-2 text-center">NON-CONF</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {teamsInDiv.map(team => (
                                  <tr key={team.id} className="hover:bg-white/[0.02] transition">
                                    <td className="px-4 py-3 flex items-center gap-3">{team.logo_url && <img src={team.logo_url} alt="" className="w-5 h-5 object-contain" />}<span className="font-bold uppercase tracking-wider">{team.name}</span></td>
                                    <td className="px-2 py-3 text-center font-medium text-white">{team.wins}</td><td className="px-2 py-3 text-center font-medium text-white">{team.losses}</td><td className="px-2 py-3 text-center font-medium text-white">{team.ties}</td>
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

        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-3 gap-4 sm:gap-0">
            <h2 className="text-xl font-black italic uppercase tracking-wider text-white">Season Schedule</h2>
            <div className="flex bg-neutral-900 border border-white/10 rounded-xl p-1">
              <button onClick={() => setSeasonPhase('regular')} className={`flex-1 sm:px-6 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${seasonPhase === 'regular' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`} style={seasonPhase === 'regular' ? { color: displayColor } : {}}>Regular Season</button>
              <button onClick={() => setSeasonPhase('playoffs')} className={`flex-1 sm:px-6 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${seasonPhase === 'playoffs' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`} style={seasonPhase === 'playoffs' ? { color: displayColor } : {}}>Playoffs</button>
            </div>
          </div>

          {seasonPhase === 'playoffs' && (
            <div className="flex justify-end animate-fadeIn">
              <div className="flex bg-neutral-900 border border-white/10 rounded-lg p-1">
                <button onClick={() => setPlayoffView('cards')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all flex items-center gap-2 ${playoffView === 'cards' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}><LayoutGrid size={14} /> Cards</button>
                <button onClick={() => setPlayoffView('bracket')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all flex items-center gap-2 ${playoffView === 'bracket' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}><Trophy size={14} /> Bracket</button>
              </div>
            </div>
          )}
          
          {seasonPhase === 'playoffs' && playoffView === 'bracket' ? (
            <PlayoffLiveView 
              userAccentColor={userColor} 
              userInitialSeeds={computedSeeds} 
              realResults={{}} 
            />
          ) : (
            displayWeeks.length === 0 ? (
              <div className="bg-neutral-900 border border-white/5 rounded-xl p-8 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">No matchups scheduled for {seasonPhase === 'regular' ? 'the regular season' : 'the playoffs'} yet.</div>
            ) : (
              displayWeeks.map(week => {
                const isWeekOpen = expandedWeek === week;
                const weekGames = gamesByWeek[week];
                const isSuperBowlWeek = week === 'SB';
                const isCurrentWeek = week === currentActiveWeek;
                const isFinished = weekGames.length > 0 && weekGames.every(g => g.status === 'finished');

                return (
                  <div key={week} className={`rounded-xl border overflow-hidden transition-all animate-fadeIn ${isSuperBowlWeek && isWeekOpen ? 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]' : 'bg-neutral-900/40 border-white/5 shadow-sm'}`}>
                    <button onClick={() => setExpandedWeek(isWeekOpen ? null : week)} className={`w-full flex justify-between items-center p-4 sm:p-5 transition text-left border-b border-white/5 ${isSuperBowlWeek ? 'bg-gradient-to-r from-purple-900/40 via-black to-amber-900/40 hover:from-purple-900/60' : 'bg-neutral-900/90 hover:bg-neutral-800'}`}>
                      <div className="flex items-center gap-3">
                        {isWeekOpen && !isSuperBowlWeek && <div className="w-1.5 h-6 rounded-full shadow-lg" style={{ backgroundColor: displayColor, boxShadow: `0 0 10px ${displayColor}80` }}></div>}
                        {isWeekOpen && isSuperBowlWeek && <Trophy size={20} className="animate-pulse text-amber-400" />}
                        <span className="font-black text-base uppercase tracking-widest" style={{ color: isWeekOpen && !isSuperBowlWeek ? displayColor : '#ffffff', textShadow: isWeekOpen && !isSuperBowlWeek ? `0 0 15px ${displayColor}80` : 'none' }}>{seasonPhase === 'playoffs' ? (playoffNames[week] || week) : `Week ${week}`}</span>
                        {!isSuperBowlWeek && (
                          isCurrentWeek ? <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase font-black px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/30 tracking-widest animate-pulse ml-2">Current Week</span> : isFinished ? <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase font-black px-1.5 py-0.5 bg-white/10 text-gray-400 rounded tracking-widest ml-2">Finished</span> : <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase font-black px-1.5 py-0.5 bg-white/5 text-gray-500 rounded tracking-widest ml-2">Upcoming</span>
                        )}
                      </div>
                      <span className="text-gray-500 text-xs font-bold shrink-0">{isWeekOpen ? '▲ Collapse' : '▼ Expand'}</span>
                    </button>

                    {isWeekOpen && (
                      <div className={`p-3 sm:p-4 ${isSuperBowlWeek ? 'bg-black/40' : 'bg-black/30'}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                          {weekGames.map(game => (
                            <GameCard 
                              key={game.id} 
                              game={game} 
                              userTeamColor={userColor} 
                              homeTeam={teamsMap[game.home_team_id?.toString()] || { name: 'Home', abbr: 'HOME', color: '#171717' }} 
                              awayTeam={teamsMap[game.away_team_id?.toString()] || { name: 'Away', abbr: 'AWAY', color: '#171717' }} 
                              hidePicks={true} // <-- Aqui está a mágica de volta!
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
      </div>
    </main>
  );
}