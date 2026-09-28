"use client";

import { Moon, Star, Flame, Plane, Drumstick, ShoppingCart, TreePine, Tv, type LucideIcon } from 'lucide-react';

export default function BroadcastBadge({ tag }: { tag: string | null }) {
  if (!tag) return null;

  let styles = "";
  let label = tag;
  let Icon: LucideIcon | null = null;

  switch (tag.toUpperCase()) {
    case 'TNF':
      // Estilo Prime Video: Azul escuro com ciano neon
      styles = "bg-gradient-to-r from-blue-950/90 to-cyan-950/90 text-cyan-400 border-cyan-500/30 backdrop-blur-md";
      label = "Thursday Night";
      Icon = Moon;
      break;
    case 'SNF':
      // Estilo NBC: Dourado vivo, texto preto, com brilho
      styles = "bg-gradient-to-r from-yellow-500 to-amber-500 text-black border-yellow-300 shadow-[0_0_12px_rgba(245,158,11,0.4)] font-extrabold";
      label = "Sunday Night";
      Icon = Star;
      break;
    case 'MNF':
      // Estilo ESPN: Vermelho sangue e preto
      styles = "bg-gradient-to-r from-red-950/90 to-black/90 text-red-500 border-red-600/30 backdrop-blur-md";
      label = "Monday Night";
      Icon = Flame;
      break;
    case 'INT':
      // Estilo Global: Verde esmeralda terroso
      styles = "bg-gradient-to-r from-emerald-950/90 to-teal-950/90 text-emerald-400 border-emerald-500/30 backdrop-blur-md";
      label = "International";
      Icon = Plane;
      break;
    case 'THX':
      // Estilo Ação de Graças: Tons de outono/peru
      styles = "bg-gradient-to-r from-orange-950/90 to-amber-950/90 text-orange-400 border-orange-500/30 backdrop-blur-md";
      label = "Thanksgiving";
      Icon = Drumstick;
      break;
    case 'BLK':
      // Estilo Black Friday: Todo preto, borda neon discreta
      styles = "bg-black/90 text-white border-neutral-700 shadow-inner backdrop-blur-md";
      label = "Black Friday";
      Icon = ShoppingCart;
      break;
    case 'XMAS':
      // Estilo Natal: Mistura de vermelho escuro com borda verde
      styles = "bg-gradient-to-r from-red-950/90 to-red-900/90 text-white border-green-500/50 backdrop-blur-md";
      label = "Christmas Special";
      Icon = TreePine;
      break;
    case 'SAT':
      // Estilo NFL Network: Roxo escuro institucional
      styles = "bg-gradient-to-r from-indigo-950/90 to-purple-950/90 text-purple-300 border-purple-500/30 backdrop-blur-md";
      label = "Saturday Game";
      Icon = Tv;
      break;
    default:
      // Fallback genérico
      styles = "bg-neutral-900/90 text-neutral-400 border-neutral-700 backdrop-blur-md";
      label = tag;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-sport font-bold text-[9px] uppercase tracking-wider border shadow-md transition-all ${styles}`}>
      {Icon && <Icon size={11} className="shrink-0 drop-shadow-sm" />}
      <span className="drop-shadow-sm">{label}</span>
    </span>
  );
}