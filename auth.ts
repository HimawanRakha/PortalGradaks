import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/app/generated/prisma/enums";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        nrp: { label: "NRP", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const nrp = credentials?.nrp;
        const password = credentials?.password;
        if (typeof nrp !== "string" || typeof password !== "string" || !nrp || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { nrp } });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          nrp: user.nrp,
          role: user.role,
          regionId: user.regionId,
          unitId: user.unitId,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.nrp = user.nrp;
        token.role = user.role;
        token.regionId = user.regionId;
        token.unitId = user.unitId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.nrp = token.nrp as string;
      session.user.role = token.role as Role;
      session.user.regionId = token.regionId as string | null;
      session.user.unitId = token.unitId as string | null;
      return session;
    },
  },
});
