import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Twitter from "next-auth/providers/twitter";

const providers = [
  Credentials({
    id: "observer-credentials",
    name: "Observer credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;
      const response = await fetch(`${process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
        cache: "no-store",
      }).catch(() => null);
      return response?.ok ? { id: email, email, name: "Observer" } : null;
    },
  }),
  Credentials({
    id: "siwe",
    name: "Ethereum wallet (SIWE mock)",
    credentials: {
      message: { label: "SIWE message", type: "text" },
      signature: { label: "Wallet signature", type: "text" },
      address: { label: "Wallet address", type: "text" },
    },
    async authorize(credentials) {
      const address = String(credentials?.address ?? "").trim();
      const message = String(credentials?.message ?? "").trim();
      const signature = String(credentials?.signature ?? "").trim();
      if (!address || !message || !signature) return null;
      return { id: address.toLowerCase(), name: address, email: `${address.toLowerCase()}@wallet.local` };
    },
  }),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })]
    : []),
  ...(process.env.AUTH_TWITTER_ID && process.env.AUTH_TWITTER_SECRET
    ? [Twitter({ clientId: process.env.AUTH_TWITTER_ID, clientSecret: process.env.AUTH_TWITTER_SECRET })]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers,
});