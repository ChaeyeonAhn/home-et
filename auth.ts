import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { CALENDAR_SCOPE } from "@/lib/dday";

// 로그인은 선택 사항: AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / AUTH_SECRET 이 있을 때만 켜져요.
// 회원 DB 없이 JWT 세션만 씁니다 (MVP).
export const authEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET,
);

declare module "next-auth" {
  interface Session {
    /** 캘린더 권한을 받았는지 (토큰 자체는 브라우저로 보내지 않음) */
    calendar?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number; // 초 단위 (Unix)
    scope?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    // Google 토큰은 암호화된 세션 쿠키(JWT) 안에만 보관. /api/calendar 가 서버에서 꺼내 씀
    jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
        token.expiresAt = account.expires_at;
        token.scope = account.scope;
      }
      return token;
    },
    session({ session, token }) {
      session.calendar = Boolean(token.scope?.split(" ").includes(CALENDAR_SCOPE));
      return session;
    },
  },
});
