import type { DefaultSession } from "next-auth";
import type { Role } from "@/app/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    nrp: string;
    role: Role;
    regionId: string | null;
    unitId: string | null;
  }

  interface Session {
    user: {
      id: string;
      nrp: string;
      role: Role;
      regionId: string | null;
      unitId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    nrp: string;
    role: Role;
    regionId: string | null;
    unitId: string | null;
  }
}
