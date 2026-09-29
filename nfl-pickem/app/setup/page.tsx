"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { getSafeColor, getIsLight, getLuminance } from '@/lib/color';

export default function SetupPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [nickname, setNickname] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  // Estados locais para a iluminação do fundo
  const [ambientPrimary, setAmbientPrimary] = useState<string>('#111');
  const [ambientSecondary, setAmbientSecondary] = useState<string>('#ff2a2a');

  useEffect(() => {
    async function checkAuthAndLoadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true });

      if (teamsData) {
        const teamsList = teamsData || [];
        const freeAgent = teamsList.find(t => t.abbreviation === 'TBD');
        const others = teamsList.filter(t => t.abbreviation !== 'TBD');
        setTeams(freeAgent ? [{ ...freeAgent, name: 'Free Agent' }, ...others] : others);
      }
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nickname, favorite_team_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileData) {
        if (profileData.nickname) setNickname(profileData.nickname);
        if (profileData.favorite_team_id !== undefined) {
          setSelectedTeamId(profileData.favorite_team_id);
          
          const savedTeam = teamsData?.find(t => t.id === profileData.favorite_team_id);
          if (savedTeam) {
            setAmbientPrimary(savedTeam.primary_color || '#111');
            setAmbientSecondary(savedTeam.secondary_color || '#ff2a2a');
          }
        }
      }

      setLoading(false);
    }

    checkAuthAndLoadData();

    // Limpeza ao sair para reverter Header e Footer caso não salve
    return () => {
      window.dispatchEvent(new Event('team-updated'));
    };
  }, [router, supabase]);

  const handleTeamClick = (team: any) => {
    setSelectedTeamId(team.id);
    setAmbientPrimary(team.primary_color || '#111');
    setAmbientSecondary(team.secondary_color || '#ff2a2a');
    
    // Preview Instantâneo Global
    window.dispatchEvent(new CustomEvent('preview-team', {
      detail: {
        primary_color: team.primary_color,
        secondary_color: team.secondary_color
      }
    }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const updateData = { 
        id: session.user.id,
        nickname: nickname,
        favorite_team_id: selectedTeamId
      };

      const { error: updateError } = await supabase.from('profiles').upsert(updateData);
      if (updateError) throw updateError;

      const chosenTeam = teams.find(t => t.id === selectedTeamId);
      const newColor = chosenTeam ? getSafeColor(chosenTeam.primary_color) : '#ff2a2a';
      localStorage.setItem('blitz_accent', newColor);
      document.documentElement.style.setProperty('--team-accent', newColor);

      // Confirma e aplica as alterações globais
      window.dispatchEvent(new Event('team-updated'));
      router.push('/dashboard');
    } catch (catchError) {
      console.error(catchError);
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  // Descobre qual cor (Primária ou Secundária) é a mais clara/brilhante
  const lumPri = getLuminance(ambientPrimary);
  const lumSec = getLuminance(ambientSecondary);
  const activeAccentColor = lumPri > lumSec ? ambientPrimary : ambientSecondary;
  
  const isAccentLight = getIsLight(activeAccentColor);

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center py-12 px-4 sm:px-6 relative overflow-hidden">
      
      {/* ATMOSFERA DINÂMICA (Glowing Orbs) */}
      <div 
        className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-[120px] opacity-40 transition-colors duration-1000 pointer-events-none z-0"
        style={{ backgroundColor: ambientPrimary }}
      />
      <div 
        className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-[120px] opacity-30 transition-colors duration-1000 pointer-events-none z-0"
        style={{ backgroundColor: ambientSecondary }}
      />
      
      {/* Faixinhas de Transmissão (Textura Esportiva) */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-25"
        style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
      />

      <div 
        className="w-full max-w-2xl bg-black/70 backdrop-blur-xl border-t-4 border-white/10 rounded-3xl p-6 sm:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative z-10 transition-colors duration-700"
        style={{ borderTopColor: activeAccentColor }}
      >
        
        <div className="text-center mb-8">
          <h1 className="font-jersey font-bold text-2xl sm:text-5xl tracking-widest text-white uppercase mb-2">
            SIGN <span style={{ color: activeAccentColor, textShadow: `0 0 15px ${activeAccentColor}80` }} className="transition-colors duration-500">CONTRACT</span>
          </h1>
          <p className="text-gray-400 font-sans text-xs sm:text-sm font-bold uppercase tracking-widest">
            Customize your profile before entering the field.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-8">
          
          <div className="bg-black/60 p-4 sm:p-6 rounded-2xl border-l-4 relative overflow-hidden transition-colors duration-500" style={{ borderLeftColor: activeAccentColor, borderTop: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <label className="block font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
              1. Player Nickname
            </label>
            <input
              type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-transparent font-jersey text-xl sm:text-2xl tracking-widest focus:outline-none transition-all placeholder:text-neutral-800"
              style={{ color: selectedTeamId ? activeAccentColor : '#ffffff' }}
              placeholder="EX: LEGEND99" required
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 mb-3 flex justify-between">
              <span>2. Select Franchise</span>
              <span className="text-gray-600">OPTIONAL</span>
            </label>
            
            <div className="-m-2 p-2 grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[340px] overflow-y-auto custom-scrollbar">
              {teams.map((team) => {
                const isSelected = selectedTeamId === team.id;
                
                // Pega apenas a última palavra do nome ("Buccaneers", "Commanders", "49ers") para não estourar
                let displayName = 'FA';
                if (team.abbreviation === 'TBD') {
                  displayName = 'FREE AGENT';
                } else if (team.name) {
                  const parts = team.name.trim().split(' ');
                  displayName = parts[parts.length - 1]; 
                } else {
                  displayName = team.abbreviation;
                }

                // Para cada card individual, descobre a cor mais clara do time para usar na borda/texto
                const teamPri = team.primary_color || '#111';
                const teamSec = team.secondary_color || '#ff2a2a';
                const cardAccentColor = getLuminance(teamPri) > getLuminance(teamSec) ? teamPri : teamSec;

                return (
                  <div
                    key={team.id} 
                    onClick={() => handleTeamClick(team)} 
                    className={`cursor-pointer rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 border ${
                      isSelected 
                        ? 'bg-black/90 scale-[1.05] z-10 shadow-2xl' 
                        : 'bg-black/40 border-white/5 hover:bg-white/5 opacity-60 hover:opacity-100 grayscale hover:grayscale-0'
                    }`}
                    style={{ 
                      borderColor: isSelected ? cardAccentColor : '', 
                      boxShadow: isSelected ? `0 10px 25px ${ambientPrimary}60` : 'none' 
                    }}
                    title={team.name} // Mostra o nome completo no hover se cortar
                  >
                    <span 
                      className="font-jersey text-xs sm:text-[13px] tracking-wide text-center uppercase truncate w-full px-1 transition-colors"
                      style={{ color: isSelected ? cardAccentColor : '#666' }}
                    >
                      {displayName}
                    </span>
                    
                    {team.logo_url ? (
                      <img src={team.logo_url} alt="" className={`w-10 h-10 object-contain drop-shadow-md transition-transform ${isSelected ? 'scale-110' : ''}`} />
                    ) : (
                      <div className="w-10 h-10 bg-white/5 rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit" disabled={saving || !nickname}
            className="w-full font-jersey font-bold text-xl sm:text-2xl tracking-wider py-4 sm:py-5 rounded-2xl transition-all duration-300 disabled:opacity-50 cursor-pointer hover:scale-[1.02]"
            style={{ 
              backgroundColor: activeAccentColor, 
              color: isAccentLight ? '#000' : '#fff', 
              boxShadow: `0 0 20px ${activeAccentColor}50` 
            }}
          >
            {saving ? "SIGNING..." : "ENTER LOCKER ROOM"}
          </button>
        </form>
      </div>
    </main>
  );
}