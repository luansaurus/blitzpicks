'use client';

import { useState } from 'react';
import { Trophy, ArrowRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  primary_color: string;
  logo_url: string;
}

interface SetupFormProps {
  teams: Team[];
}

export default function SetupForm({ teams }: SetupFormProps) {
  const [nickname, setNickname] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const accentColor = selectedTeam?.primary_color || '#FF0000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname || !selectedTeamId) return;
    
    setIsLoading(true);

    // 1. Obtém a sessão do utilizador logado no momento
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("Error: No authenticated player found.");
      setIsLoading(false);
      return;
    }

    // 2. Guarda o Nickname e a Equipa na tabela profile
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        nickname: nickname,
        favorite_team_id: selectedTeamId,
      });

    if (error) {
      console.error('Error updating profile:', error);
      // Se o nickname já existir (é UNIQUE na base de dados), avisamos o utilizador
      if (error.code === '23505') {
        alert("This Nickname is already taken by another player. Choose another one.");
      } else {
        alert("Fumble! Something went wrong saving your profile.");
      }
      setIsLoading(false);
      return;
    }

    // 3. Sucesso! Redireciona para o Dashboard (página inicial)
    router.push('/');
  };

  return (
    <div 
      className="min-h-screen bg-nfl-black text-white py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center relative overflow-hidden"
      style={{ '--team-accent': accentColor } as React.CSSProperties}
    >
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 blur-[120px] pointer-events-none transition-colors duration-700 ease-in-out"
        style={{ backgroundColor: 'var(--team-accent)' }}
      ></div>

      <div className="w-full max-w-4xl z-10 space-y-12">
        
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/20 mb-6 shadow-xl">
            <Trophy size={32} className="text-white" />
          </div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter drop-shadow-lg">
            Draft <span style={{ color: 'var(--team-accent)' }} className="transition-colors duration-500">Day</span>
          </h1>
          <p className="text-nfl-gray font-medium tracking-wide uppercase text-sm">
            Configure your player profile before stepping onto the gridiron
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          
          <div className="bg-gray-900/50 p-8 border-l-4 backdrop-blur-sm transition-colors duration-500 shadow-2xl" style={{ borderLeftColor: 'var(--team-accent)' }}>
            <label htmlFor="nickname" className="block text-sm font-bold text-nfl-light uppercase tracking-widest mb-4">
              1. What's your Nickname?
            </label>
            <input
              id="nickname"
              type="text"
              required
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={isLoading}
              className="appearance-none block w-full bg-black/60 text-white text-2xl font-bold px-4 py-4 border-b-2 focus:outline-none transition-colors duration-300 placeholder:text-gray-700 placeholder:font-medium disabled:opacity-50"
              style={{ borderBottomColor: nickname ? 'var(--team-accent)' : '#4B5563' }}
              placeholder="Ex: QB_Legend99"
            />
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold uppercase tracking-wider">
                2. Choose your Franchise
              </h2>
              <p className="text-nfl-gray text-sm mt-2">
                This logo will be your Avatar on the Leaderboard
              </p>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 bg-gray-900/30 p-6 rounded-xl border border-white/5 shadow-inner">
              {teams.map((team) => {
                const isSelected = selectedTeamId === team.id;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setSelectedTeamId(team.id)}
                    disabled={isLoading}
                    className={`relative group aspect-square flex items-center justify-center p-2 rounded-lg transition-all duration-300 ${
                      isSelected 
                        ? 'bg-white/10 scale-110 shadow-2xl z-10' 
                        : 'hover:bg-white/5 hover:scale-105 grayscale hover:grayscale-0 opacity-60 hover:opacity-100 disabled:opacity-30'
                    }`}
                    style={{ 
                      boxShadow: isSelected ? `0 0 20px ${team.primary_color}40` : 'none',
                      border: isSelected ? `2px solid ${team.primary_color}` : '2px solid transparent'
                    }}
                  >
                    <img 
                      src={team.logo_url} 
                      alt={team.name} 
                      className="w-full h-full object-contain drop-shadow-md"
                    />
                    <div className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold whitespace-nowrap bg-black px-2 py-1 rounded">
                      {team.abbreviation}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center pt-8">
            <button
              type="submit"
              disabled={!nickname || !selectedTeamId || isLoading}
              className="flex items-center gap-3 px-12 py-5 text-xl font-black italic uppercase tracking-wider text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-2xl"
              style={{ backgroundColor: 'var(--team-accent)' }}
            >
              {isLoading ? 'Processing Pick...' : 'Confirm Pick'}
              {!isLoading && <ArrowRight size={24} />}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}