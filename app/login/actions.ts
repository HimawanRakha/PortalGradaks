"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const nrp = formData.get("nrp");
  const password = formData.get("password");

  if (typeof nrp !== "string" || !nrp.trim() || typeof password !== "string" || !password) {
    return { error: "NRP dan password wajib diisi." };
  }

  try {
    await signIn("credentials", {
      nrp: nrp.trim(),
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "NRP atau password salah." };
        default:
          return { error: "Terjadi kesalahan saat masuk. Coba lagi." };
      }
    }
    throw error;
  }
}
