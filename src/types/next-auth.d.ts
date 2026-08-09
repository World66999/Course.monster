import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "EDITOR" | "USER";
      chatDisplayName: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "ADMIN" | "EDITOR" | "USER";
    chatDisplayName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    chatDisplayName?: string | null;
  }
}
