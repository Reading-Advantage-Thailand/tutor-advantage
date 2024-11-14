import { PrismaAdapter } from '@auth/prisma-adapter';
import type { User as PrismaUser } from '@prisma/client';
import { compare } from 'bcryptjs';
import type { AuthOptions, DefaultSession, Session, User } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import type { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

import { prisma } from './prisma';

type UserWithRole = PrismaUser & {
  role: string;
};

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    } & DefaultSession['user'];
  }
  interface User extends UserWithRole {}
}

export const config: AuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials');
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            password: true,
            emailVerified: true,
            image: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        console.log('Found user:', user);

        if (!user?.password) {
          console.log('No password found for user');
          return null;
        }

        const isValid = await compare(credentials.password, user.password);
        console.log('Password comparison result:', isValid);

        if (!isValid) {
          console.log('Invalid password');
          return null;
        }

        return {
          id: user.id,
          email: user.email || '',
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
          image: user.image,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          password: user.password,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
      }
      return session;
    },
    async jwt({ token, user }: { token: JWT; user: User | null }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
  },
  debug: true,
};
