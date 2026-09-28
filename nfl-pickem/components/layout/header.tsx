"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { Shirt, ClipboardList, Trophy, BarChart3, Calendar, Settings, HelpCircle, type LucideIcon } from 'lucide-react';
import HelpModal from '../ui/HelpModal'; 

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

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [logoUrl, setLogoUrl] = useState<string>('https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  
  const [headerBg, setHeaderBg] = useState<string>('#0a0a0a');
  const [headerSec, setHeaderSec] = useState<string>('#ff2a2a');
  const [isLightBg, setIsLightBg] = useState<boolean>(false);
  
  const supabase = createClient();

  useEffect(() => {
    async function fetchUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('favorite_team_id, is_admin')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        setIsAdmin(!!profile.is_admin);
        
        if (profile.favorite_team_id) {
          // Buscamos agora a primary_color e a secondary_color
          const { data: team } = await supabase.from('teams').select('logo_url, primary_color, secondary_color').eq('id', profile.favorite_team_id).single();
          if (team) {
            if (team.logo_url) setLogoUrl(team.logo_url);
            
            if (team.primary_color) {
              setHeaderBg(team.primary_color);
              setIsLightBg(getIsLight(team.primary_color));
              
              const vibrantSafeColor = getSafeColor(team.primary_color);
              localStorage.setItem('blitz_accent', vibrantSafeColor);
              document.documentElement.style.setProperty('--team-accent', vibrantSafeColor);
            }
            
            if (team.secondary_color) {
              // Aplica a cor secundária nos detalhes da UI
              setHeaderSec(team.secondary_color);
              document.documentElement.style.setProperty('--team-secondary', team.secondary_color);
            }
          }
        } else {
           localStorage.setItem('blitz_accent', '#ff2a2a');
           document.documentElement.style.setProperty('--team-accent', '#ff2a2a');
           document.documentElement.style.setProperty('--team-secondary', '#ffffff');
        }
      }
    }
    fetchUserData();
    const handleTeamSaved = () => fetchUserData();
    
    const handleTeamPreview = (e: any) => {
      const detail = e.detail;
      if (detail?.primary_color) {
        setHeaderBg(detail.primary_color);
        setIsLightBg(getIsLight(detail.primary_color));
      } else {
        setHeaderBg('#0a0a0a');
      }
      setHeaderSec(detail?.secondary_color || '#ff2a2a');
    };

    window.addEventListener('team-updated', handleTeamSaved);
    window.addEventListener('preview-team', handleTeamPreview);
    
    return () => {
      window.removeEventListener('team-updated', handleTeamSaved);
      window.removeEventListener('preview-team', handleTeamPreview);
    };
  }, [supabase]);

  

  const handleLogout = async () => {
    if (loadingLogout) return;
    setLoadingLogout(true);
    
    try {
      await supabase.auth.signOut();
      router.refresh();
      router.push('/login');
    } catch (error) {
      console.error("Erro ao efetuar logout:", error);
    } finally {
      setLoadingLogout(false);
    }
  };

  const navLinks: { name: string; path: string; icon: LucideIcon }[] = [
    { name: 'Locker', path: '/dashboard', icon: Shirt },
    { name: 'Picks', path: '/picks', icon: ClipboardList },
    { name: 'Bracket', path: '/bracket', icon: Trophy },
    { name: 'Ranking', path: '/ranking', icon: BarChart3 },
    { name: 'Season', path: '/results', icon: Calendar }
  ];

  const textMain = isLightBg ? 'text-black' : 'text-white';
  const textMuted = isLightBg ? 'text-neutral-800' : 'text-neutral-400';
  const hoverColor = isLightBg ? 'hover:text-black hover:drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]' : 'hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]';
  const groupHoverColor = isLightBg ? 'group-hover:text-black' : 'group-hover:text-white';
  const textureColor = isLightBg ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

  return (
    <>
      {/* HEADER DINÂMICO COM A COR PRIMÁRIA DO TIME */}
      <header className="border-b-4 relative z-40 transition-colors duration-500" style={{ backgroundColor: headerBg, borderBottomColor: headerSec }}>
        
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 4px, ${textureColor} 4px, ${textureColor} 8px)`
          }}
        />

        <div className="max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between relative z-10">
          
          <Link href="/dashboard" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
            <span className={`text-2xl sm:text-3xl font-black italic uppercase tracking-tighter ${textMain}`}>
              BLITZ
              <span 
                style={{ 
                  color: headerSec, 
                  textShadow: isLightBg ? 'none' : '0 2px 4px rgba(0,0,0,0.6)' 
                }}
              >
                PICKS
              </span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center h-full">
            {navLinks.map((link) => {
              const isActive = pathname === link.path || (link.path !== '/dashboard' && pathname.startsWith(link.path));
              return (
                <Link 
                  key={link.path} 
                  href={link.path} 
                  className="relative h-full flex items-center px-5 group overflow-hidden"
                >
                  <span className={`relative z-10 text-[14px] font-black uppercase tracking-widest transition-colors ${isActive ? textMain : textMuted} ${groupHoverColor}`}>
                    {link.name}
                  </span>
                  
                  {/* Linha Ativa no Desktop - Usando Cor Secundária */}
                  {isActive && (
                    <span 
                      className="absolute bottom-0 left-0 w-full h-[5px] origin-bottom-left -skew-x-12 z-20"
                      style={{ backgroundColor: headerSec }} 
                    />
                  )}
                  
                  <span className={`absolute bottom-0 left-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity ${isLightBg ? 'bg-black/5' : 'bg-white/10'}`} />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 sm:gap-6 h-full">
            
            <button 
              onClick={() => setIsHelpOpen(true)}
              title="Help & Rules"
              className={`${textMuted} ${hoverColor} transition-all duration-300 flex items-center gap-1.5`}
            >
              <HelpCircle size={22} />
              <span className="hidden md:inline text-[13px] font-black uppercase tracking-widest">HELP</span>
            </button>

            {isAdmin && (
              <Link href="/admin" className={`text-neutral-500 ${hoverColor} transition-colors flex items-center gap-1`}>
                <Settings size={20} />
                <span className="hidden sm:inline text-[13px] font-black uppercase tracking-widest">ADMIN</span>
              </Link>
            )}
            
            <div className={`w-[2px] h-6 hidden sm:block -skew-x-12 ${isLightBg ? 'bg-black/20' : 'bg-white/20'}`}></div>

            <Link href="/setup" title="Profile" className="relative flex items-center justify-center group hover:scale-105 transition-transform">
              <div 
                className={`w-10 h-10 rounded-sm bg-[#111] flex items-center justify-center overflow-hidden p-1 border transition-colors`}
                style={{ borderColor: isLightBg ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)' }}
              >
                <img src={logoUrl} alt="User Logo" className="w-full h-full object-contain" />
              </div>
            </Link>
            
            <button 
              onClick={handleLogout} 
              disabled={loadingLogout}
              className={`hidden sm:block text-[13px] font-black ${textMuted} ${hoverColor} uppercase tracking-widest transition-all disabled:opacity-50`}
            >
              {loadingLogout ? 'WAIT...' : 'SIGN OUT'}
            </button>
          </div>
        </div>
      </header>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-white/10 z-50 px-2 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        <div className="flex justify-around items-center h-16 relative">
          {navLinks.map((link) => {
            const isActive = pathname === link.path || (link.path !== '/dashboard' && pathname.startsWith(link.path));
            const Icon = link.icon;
            
            return (
              <Link 
                key={link.path} 
                href={link.path} 
                className="relative flex flex-col items-center justify-center w-full h-full gap-1 pt-1" 
                style={isActive ? { color: 'white' } : { color: '#666' }}
              >
                {/* Linha indicadora usando a cor Secundária do time */}
                {isActive && (
                  <div 
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[3px] rounded-b-sm" 
                    style={{ backgroundColor: headerSec }} 
                  />
                )}
                
                <Icon size={22} className={`transition-transform ${isActive ? 'scale-110' : ''}`} style={isActive ? { color: headerSec } : {}} />
                
                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {link.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <HelpModal 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
        accentColor="var(--team-accent)" 
      />
    </>
  );
}