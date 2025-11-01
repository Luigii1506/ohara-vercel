import { NextAuthOptions } from 'next-auth';

/**
 * Configuración centralizada de NextAuth
 * Esta configuración se reutiliza en todas las rutas API
 */
export const authOptions: NextAuthOptions = {
  providers: [],
  session: { strategy: 'jwt' as const },
  callbacks: {
    async session({ session, token }: any) {
      if (session?.user && token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ user, token }: any) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
};