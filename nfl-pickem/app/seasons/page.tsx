"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/header';

const SEASONS_DATA = [
  {
    year: 2024,
    sbRoman: 'LIX',
    location: 'New Orleans, LA',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/82/Super_Bowl_LIX_Logo.svg/960px-Super_Bowl_LIX_Logo.svg.png',
    isCompleted: true,
    hasAppData: false, // Sem dados no banco para essa temporada
    winner: {
      name: 'Eagles',
      abbreviation: 'PHI',
      logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
      score: '40',
    },
    loser: {
      name: 'Chiefs',
      abbreviation: 'KC',
      logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
      score: '22',
    }
  },
  {
    year: 2025,
    sbRoman: 'LX',
    location: 'Santa Clara, CA',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b0/Super_Bowl_LX_Logo.svg/960px-Super_Bowl_LX_Logo.svg.png',
    isCompleted: true,
    hasAppData: false, // Sem dados no banco para essa temporada
    winner: {
      name: 'Seahawks',
      abbreviation: 'SEA',
      logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
      score: '29',
    },
    loser: {
      name: 'Patriots',
      abbreviation: 'NE',
      logoUrl: 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
      score: '13',
    }
  },
  {
    year: 2026,
    sbRoman: 'LXI',
    location: 'Inglewood, CA',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/fr/7/74/Super_Bowl_LXI_Logo.png',
    isCompleted: false,
    hasAppData: true, // Temporada ativa no sistema
  }
];

export default function SeasonsPortal() {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('blitz_season_year');
    if (saved) {
      setSelectedYear(parseInt(saved));
    } else {
      setSelectedYear(2026);
    }
  }, []);

  const handleSelectSeason = (year: number, hasData: boolean) => {
    if (!hasData) return; // Trava de segurança no clique
    
    localStorage.setItem('blitz_season_year', year.toString());
    setSelectedYear(year);
    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col relative overflow-hidden">
      
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-red-600/10 blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-blue-600/5 blur-[120px] pointer-events-none rounded-full" />

      <Header />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-20 flex flex-col justify-center z-10">
        
        <div className="text-center mb-12 sm:mb-16 animate-fadeIn">
          <h1 className="text-4xl sm:text-6xl font-black italic uppercase tracking-tighter text-white drop-shadow-lg">
            Select <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">Season</span>
          </h1>
          <p className="text-gray-400 mt-3 font-medium text-xs sm:text-sm uppercase tracking-widest max-w-xl mx-auto">
            Travel through time. View past leaderboards, brackets, and your historical locker room stats.
          </p>
        </div>

        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6 overflow-x-auto sm:overflow-visible pb-10 snap-x snap-mandatory scrollbar-hide px-4 sm:px-0 -mx-4 sm:mx-0">
          
          {SEASONS_DATA.map((season) => {
            const isCurrentSelected = selectedYear === season.year;
            const isLocked = !season.hasAppData;

            return (
              <div 
                key={season.year}
                onClick={() => handleSelectSeason(season.year, season.hasAppData)}
                className={`snap-center shrink-0 w-[280px] sm:w-auto relative rounded-3xl transition-all duration-500 flex flex-col items-center justify-between p-8 border-2 
                  ${isLocked ? 'bg-black/60 border-white/5 opacity-70 cursor-not-allowed hover:opacity-100 grayscale-[0.3]' : 
                    isCurrentSelected ? 'bg-gradient-to-b from-neutral-800 to-neutral-950 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.15)] scale-105 cursor-pointer' : 
                    'bg-neutral-950 border-white/10 hover:border-white/30 hover:bg-neutral-900 shadow-xl cursor-pointer'}`}
              >
                {/* Indicadores do Topo */}
                {isLocked ? (
                  <div className="absolute -top-3 bg-neutral-800 text-gray-400 border border-white/10 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <span>🔒 App Data Unavailable</span>
                  </div>
                ) : isCurrentSelected && (
                  <div className="absolute -top-3 bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                    Current View
                  </div>
                )}

                <div className="h-40 flex items-center justify-center mb-6 relative w-full">
                  <img 
                    src={season.logoUrl} 
                    alt={`Super Bowl ${season.sbRoman}`} 
                    className={`max-h-full max-w-full object-contain transition-transform duration-700 ${!isLocked && isCurrentSelected ? 'scale-110 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]' : 'group-hover:scale-110'}`}
                    onError={(e) => { e.currentTarget.src = 'https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg'; }}
                  />
                </div>

                <div className="text-center w-full">
                  <h3 className="text-2xl font-black italic uppercase tracking-wider text-white mb-1">
                    {season.year} Season
                  </h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">
                    Super Bowl {season.sbRoman} • {season.location}
                  </p>

                  {season.isCompleted && season.winner && season.loser ? (
                    <div className="bg-black/60 border border-white/5 rounded-xl p-3 flex flex-col items-center relative overflow-hidden">
                      <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
                      
                      <span className="text-lg mb-1">🏆</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-amber-500/80 mb-2">World Champion</span>
                      
                      <div className="flex items-center justify-center gap-4 w-full">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-base">{season.winner.score}</span>
                          <img src={season.winner.logoUrl} className="w-8 h-8 object-contain drop-shadow-md" alt={season.winner.name} />
                        </div>
                        
                        <span className="text-[10px] font-black text-gray-600">VS</span>
                        
                        <div className="flex items-center gap-2 opacity-60">
                          <img src={season.loser.logoUrl} className="w-6 h-6 object-contain" alt={season.loser.name} />
                          <span className="font-black text-gray-400 text-sm">{season.loser.score}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`border rounded-xl p-4 flex items-center justify-center h-[92px] ${!isLocked ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        {!isLocked && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>}
                        {season.year === 2026 ? 'Active Season' : 'Upcoming Season'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}