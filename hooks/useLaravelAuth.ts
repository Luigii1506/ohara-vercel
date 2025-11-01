import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api/client";

interface LaravelUser {
  id: number;
  uuid: string;
  email: string;
  name: string;
  role: string;
}

interface LaravelAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: LaravelUser | null;
  error: string | null;
}

export function useLaravelAuth() {
  const { data: session, status } = useSession();
  const [authState, setAuthState] = useState<LaravelAuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  // Check if already authenticated with Laravel
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("laravel_token");
      if (token && session?.user) {
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: null, // You could fetch user details here
          error: null,
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null,
        });
      }
    };

    if (status !== "loading") {
      checkAuth();
    }
  }, [session, status]);

  // Sync login with Laravel when NextAuth session is established
  const syncWithLaravel = async () => {
    if (!session?.user?.email) {
      setAuthState((prev) => ({
        ...prev,
        error: "No session found",
        isLoading: false,
      }));
      return;
    }

    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      // You'll need to implement an endpoint that accepts UUID or email
      // to get or create Laravel token for existing NextAuth users
      const response = await apiClient.request<{
        token: string;
        user: LaravelUser;
      }>("/auth/sync", {
        method: "POST",
        body: {
          uuid: session.user.id, // Assuming NextAuth user has UUID
          email: session.user.email,
          name: session.user.name,
        },
      });

      if (response.token) {
        localStorage.setItem("laravel_token", response.token);
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: response.user,
          error: null,
        });
      }
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync with Laravel",
      });
    }
  };

  // Direct login with Laravel (for users not using NextAuth)
  const loginWithLaravel = async (email: string, password: string) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await apiClient.login(email, password);

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user: response.user,
        error: null,
      });

      return response;
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: error instanceof Error ? error.message : "Login failed",
      });
      throw error;
    }
  };

  // Logout from Laravel
  const logoutFromLaravel = async () => {
    try {
      await apiClient.logout();
    } finally {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    }
  };

  return {
    ...authState,
    syncWithLaravel,
    loginWithLaravel,
    logoutFromLaravel,
  };
}
