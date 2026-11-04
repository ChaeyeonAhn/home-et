import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// 로그인은 선택 사항: AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / AUTH_SECRET 이 있을 때만 켜져요.
// 회원 DB 없이 JWT 세션만 씁니다 (MVP).
export const authEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    // 어댑터 없는 OAuth에선 user.id가 로그인마다 새 UUID라서(token.sub도 바뀜),
    // 리포트 저장 키로는 Google 계정 고유 ID(sub)를 따로 담아 둔다.
    jwt({ token, account }) {
      if (account?.provider === "google" && account.providerAccountId) token.uid = `google:${account.providerAccountId}`;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});

/** 서버에서 로그인한 사용자의 저장 키. 로그인 안 했거나 예전 세션(uid 없음)이면 null */
export async function currentUid(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  return typeof id === "string" && id.startsWith("google:") ? id : null;
}
