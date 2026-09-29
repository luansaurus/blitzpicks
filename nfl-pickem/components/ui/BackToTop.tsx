"use client";

import { useState, useEffect } from 'react';

export default function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      // bottom-24 afasta o botão da barra de navegação no mobile
      // sm:bottom-10 devolve o botão para perto do rodapé no PC
      // z-[90] garante que fica acima dos cards, mas abaixo de modais grandes
      className="fixed bottom-24 sm:bottom-10 right-4 sm:right-8 p-3.5 sm:p-4 bg-black/60 backdrop-blur-xl border border-white/10 hover:bg-white/10 hover:border-white/30 hover:-translate-y-1 rounded-full shadow-[0_10px_25px_rgba(0,0,0,0.8)] transition-all duration-300 z-[90] group"
      title="Back to top"
    >
      <svg 
        className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors drop-shadow-md" 
        fill="none" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth="3" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path d="M5 15l7-7 7 7"></path>
      </svg>
    </button>
  );
}