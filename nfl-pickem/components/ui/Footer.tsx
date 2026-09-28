"use client";

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { Shirt, ClipboardList, Trophy, BarChart3, Calendar } from 'lucide-react';
import NextLink from 'next/link';

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

export default function Footer() {
  const pathname = usePathname();
  
  const [footerBg, setFooterBg] = useState<string>('#0a0a0a');
  const [footerSec, setFooterSec] = useState<string>('#ff2a2a');
  const [isLightBg, setIsLightBg] = useState<boolean>(false);
  
  const supabase = createClient();

  useEffect(() => {
    async function fetchUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('favorite_team_id')
        .eq('id', session.user.id)
        .maybeSingle();
        
      if (profile && profile.favorite_team_id) {
        const { data: team } = await supabase.from('teams').select('primary_color, secondary_color').eq('id', profile.favorite_team_id).single();
        if (team) {
          setFooterBg(team.primary_color || '#0a0a0a');
          setFooterSec(team.secondary_color || '#ff2a2a');
          setIsLightBg(getIsLight(team.primary_color || '#0a0a0a'));
        }
      }
    }

    fetchUserData();

    // 1. Ouve alterações permanentes salvas no banco
    const handleTeamSaved = () => fetchUserData();
    
    // 2. Ouve o clique na página de Setup para mudar ANTES de salvar
    const handleTeamPreview = (e: any) => {
      const detail = e.detail;
      if (detail?.primary_color) {
        setFooterBg(detail.primary_color);
        setIsLightBg(getIsLight(detail.primary_color));
      } else {
        setFooterBg('#0a0a0a');
      }
      setFooterSec(detail?.secondary_color || '#ff2a2a');
    };

    window.addEventListener('team-updated', handleTeamSaved);
    window.addEventListener('preview-team', handleTeamPreview);
    
    return () => {
      window.removeEventListener('team-updated', handleTeamSaved);
      window.removeEventListener('preview-team', handleTeamPreview);
    };
  }, [supabase]);

  const navLinks = [
    { name: 'Locker', path: '/dashboard', icon: Shirt },
    { name: 'Picks', path: '/picks', icon: ClipboardList },
    { name: 'Bracket', path: '/bracket', icon: Trophy },
    { name: 'Ranking', path: '/ranking', icon: BarChart3 },
    { name: 'Season', path: '/results', icon: Calendar }
  ];

  const textMain = isLightBg ? 'text-black' : 'text-white';
  const textMuted = isLightBg ? 'text-neutral-800' : 'text-neutral-400';
  const hoverColor = isLightBg ? 'hover:text-black hover:drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]' : 'hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]';
  const textureColor = isLightBg ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const borderColor = isLightBg ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

  return (
    <>
      {/* DESKTOP FOOTER */}
      <footer 
        className="hidden sm:block border-t-4 relative z-10 mt-auto overflow-hidden transition-colors duration-500" 
        style={{ backgroundColor: footerBg, borderTopColor: footerSec }}
      >
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 4px, ${textureColor} 4px, ${textureColor} 8px)` }}
        />
        <div className="max-w-7xl mx-auto px-4 py-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className={`text-xl font-black italic uppercase tracking-tighter ${textMain}`}>
              BLITZ<span style={{ color: footerSec, textShadow: isLightBg ? 'none' : '0 2px 4px rgba(0,0,0,0.6)' }}>PICKS</span>
            </span>
            <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>© 2026 BLITZPICKS. NOT AFFILIATED WITH THE NFL.</span>
          </div>

          <div className="flex items-center gap-6">
            {navLinks.map((link, index) => (
              <div key={link.path} className="flex items-center gap-6">
                <NextLink href={link.path} className={`text-[13px] font-black uppercase tracking-widest ${textMuted} ${hoverColor} transition-all duration-300`}>{link.name}</NextLink>
                {index < navLinks.length - 1 && <div className="w-[2px] h-4 -skew-x-12" style={{ backgroundColor: borderColor }}></div>}
              </div>
            ))}
          </div>
        </div>
      </footer>

      {/* MOBILE FOOTER INFO */}
      <footer 
        className="sm:hidden pb-24 pt-8 px-4 flex flex-col items-center justify-center gap-1 border-t mt-auto text-center relative z-0 transition-colors duration-500 overflow-hidden"
        style={{ backgroundColor: footerBg, borderTopColor: borderColor }}
      >
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 4px, ${textureColor} 4px, ${textureColor} 8px)` }}
        />
        <span className={`relative z-10 text-xl font-black italic uppercase tracking-tighter ${textMain}`}>
          BLITZ<span style={{ color: footerSec, textShadow: isLightBg ? 'none' : '0 2px 4px rgba(0,0,0,0.6)' }}>PICKS</span>
        </span>
        <span className={`relative z-10 text-[9px] font-bold uppercase tracking-widest mt-1 ${textMuted}`}>© 2026 BLITZPICKS. NOT AFFILIATED WITH THE NFL.</span>
      </footer>

      {/* MOBILE NAV */}
      <nav 
        className="sm:hidden fixed bottom-0 left-0 right-0 border-t z-50 px-2 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.8)] transition-colors duration-500"
        style={{ backgroundColor: footerBg, borderTopColor: borderColor }}
      >
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 4px, ${textureColor} 4px, ${textureColor} 8px)` }}
        />
        <div className="flex justify-around items-center h-16 relative z-10">
          {navLinks.map((link) => {
            const isActive = pathname === link.path || (link.path !== '/dashboard' && pathname.startsWith(link.path));
            const Icon = link.icon;
            
            return (
              <NextLink key={link.path} href={link.path} className="relative flex flex-col items-center justify-center w-full h-full gap-1 pt-1">
                {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[3px] rounded-b-sm" style={{ backgroundColor: footerSec }} />}
                <Icon size={22} className={`transition-transform ${isActive ? 'scale-110 drop-shadow-md' : ''}`} style={isActive ? { color: footerSec } : { color: isLightBg ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)' }} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-80'}`} style={isActive ? { color: footerSec } : { color: isLightBg ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)' }}>
                  {link.name}
                </span>
              </NextLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}