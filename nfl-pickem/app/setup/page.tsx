"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';

// Mantemos o SafeColor APENAS para salvar no localStorage
const getSafeColor = (hex: string) => {
  if (!hex) return '#ff2a2a'; 
  let r = parseInt(hex.substring(1, 3), 16) / 255;
  let g = parseInt(hex.substring(3, 5), 16) / 255;
  let b = parseInt(hex.substring(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  if (l < 0.45) { l = 0.55; s = Math.max(s, 0.90); }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
  const toHex = (x: number) => {
    const hexStr = Math.round(x * 255).toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Verifica contraste para textos sobrepostos
const getIsLight = (hex: string) => {
  if (!hex) return false;
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(x => x + x).join('');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 135; 
};

// Calcula a luminância exata para escolher a cor mais brilhante
const getLuminance = (hex: string) => {
  if (!hex) return 0;
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(x => x + x).join('');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return ((r * 299) + (g * 587) + (b * 114)) / 1000;
};

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