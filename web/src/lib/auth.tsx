"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";

import { api } from "@/lib/api";

export interface CurrentUser {
  id: number;
  full_name: string;
  phone: string;
  photo_url: string;
  company: { id: number; name: string; logo: string | null };
  branch: { id: number; name: string } | null;
  zone: { id: number; name: string } | null;
  role: { key: string; name: string; scope: "company" | "zone" | "branch" } | null;
  permissions: string[];
  branch_ids: number[] | null;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  can: (permission: string | string[]) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<{ data: CurrentUser }>("auth/me").then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });

  const user = data ?? null;

  const can = (permission: string | string[]) => {
    if (!user) {
      return false;
    }
    const required = Array.isArray(permission) ? permission : [permission];
    return required.some((item) => user.permissions.includes(item));
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return <AuthContext.Provider value={{ user, isLoading, can, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
