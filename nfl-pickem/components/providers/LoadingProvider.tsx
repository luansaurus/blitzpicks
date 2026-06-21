"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import LoadingScreen from "../ui/LoadingScreen";

export default function LoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isChangingPage, setIsChangingPage] = useState(false);

  useEffect(() => {
    setIsChangingPage(true);
    const timer = setTimeout(() => {
      setIsChangingPage(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  return (
    <>
      {isChangingPage && (
        <div className="fixed inset-0 z-50 animate-fadeIn">
          <LoadingScreen />
        </div>
      )}
      <div className={isChangingPage ? "opacity-40 transition-opacity duration-200" : "transition-opacity duration-200"}>
        {children}
      </div>
    </>
  );
}