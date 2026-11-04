"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { CALENDAR_SCOPE } from "@/lib/dday";
import { createContext, useContext, type ReactNode } from "react";

export interface AuthState {
  enabled: boolean;
  status: "loading" | "authenticated" | "unauthenticated";
  name: string | null;
  image: string | null;
  /** Google 캘린더에 일정을 넣을 권한을 받았는지 */
  calendar: boolean;
  signIn: () => void;
  /** 캘린더 권한까지 받는 로그인 (이미 로그인했어도 권한 추가 화면으로). 끝나면 redirectTo로 돌아옴 */
  connectCalendar: (redirectTo: string) => void;
  signOut: () => void;
}

const disabled: AuthState = {
  enabled: false,
  status: "unauthenticated",
  name: null,
  image: null,
  calendar: false,
  signIn: () => {},
  connectCalendar: () => {},
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
    calendar: Boolean(data?.calendar),
    signIn: () => void signIn("google"),
    connectCalendar: (redirectTo) =>
      void signIn(
        "google",
        { redirectTo },
        {
          scope: `openid email profile ${CALENDAR_SCOPE}`,
          include_granted_scopes: "true",
          access_type: "offline", // 1시간 뒤에도 등록할 수 있게 refresh token 받기
          prompt: "consent",
        },
      ),
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
