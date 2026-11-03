"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { createContext, useContext, type ReactNode } from "react";

export interface AuthState {
  enabled: boolean;
  status: "loading" | "authenticated" | "unauthenticated";
  name: string | null;
  image: string | null;
  signIn: () => void;
  signOut: () => void;
}

const disabled: AuthState = {
  enabled: false,
  status: "unauthenticated",
  name: null,
  image: null,
  signIn: () => {},
  signOut: () => {},
};

const AuthContext = createContext<AuthState>(disabled);
export const useAuth = () => useContext(AuthContext);

function Bridge({ children }: { children: ReactNode }) {
  const { data, status } = useSession();
  const value: AuthState = {
    enabled: true,
    status,
    name: data?.user?.name ?? null,
    image: data?.user?.image ?? null,
    signIn: () => void signIn("google"),
    signOut: () => void signOut(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** 브라우저용 Google Maps 키. 없으면 자동완성·지도 없이 기존 입력칸과 지도로 동작 */
export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function MapsProvider({ children }: { children: ReactNode }) {
  if (!MAPS_KEY) return children;
  return (
    <APIProvider apiKey={MAPS_KEY} language="ko" region="KR">
      {children}
    </APIProvider>
  );
}

export function Providers({ authEnabled, children }: { authEnabled: boolean; children: ReactNode }) {
  if (!authEnabled) return <AuthContext.Provider value={disabled}><MapsProvider>{children}</MapsProvider></AuthContext.Provider>;
  return (
    <SessionProvider>
      <Bridge>
        <MapsProvider>{children}</MapsProvider>
      </Bridge>
    </SessionProvider>
  );
}
