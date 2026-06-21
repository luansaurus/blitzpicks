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
      className="fixed bottom-6 right-6 p-3 sm:p-4 bg-neutral-800 border border-white/10 hover:bg-neutral-700 hover:-translate-y-1 text-white rounded-full shadow-2xl transition-all duration-300 z-50 group"
      title="Back to top"
    >
      <svg 
        className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" 
        fill="none" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth="2" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path d="M5 15l7-7 7 7"></path>
      </svg>
    </button>
  );
}