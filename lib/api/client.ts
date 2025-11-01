import { getSession } from "next-auth/react";

const API_BASE_URL = "/api";
const API_CLIENT =
  "7hEARLQWpQjCWvl7wg9fz88dAmVW8Yy5jMEnv0izWmcEffkGhShYCMvpT7xw";

interface ApiConfig {
  headers?: Record<string, string>;
  method?: string;
  body?: any;
}

class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    // First try to get from localStorage
    const token = localStorage.getItem("laravel_token");
    if (token) return token;

    // Then try to get from session
    const session = await getSession();
    if (session?.user) {
      // You might store the Laravel token in session
      return null;
    }
    return null;
  }

  public async getHeaders(
    includeAuth: boolean = true
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-client": API_CLIENT,
    };

    if (includeAuth) {
      const token = await this.getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async request<T>(endpoint: string, config: ApiConfig = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await this.getHeaders(config.headers ? false : true);

    if (config.headers) {
      Object.assign(headers, config.headers);
    }

    const options: RequestInit = {
      method: config.method || "GET",
      headers,
    };

    if (config.body && config.method !== "GET") {
      options.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Request failed" }));
        throw new Error(
          error.message || `HTTP error! status: ${response.status}`
        );
      }

      return response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // Auth methods
  async login(email: string, password: string) {
    const response = await this.request<{ token: string; user: any }>(
      "/auth/token",
      {
        method: "POST",
        body: { email, password },
      }
    );

    // Store token for future requests
    if (response.token) {
      localStorage.setItem("laravel_token", response.token);
    }

    return response;
  }

  async refreshToken() {
    return this.request<{ token: string }>("/auth/refresh", {
      method: "POST",
    });
  }

  async logout() {
    try {
      await this.request("/auth/revoke", {
        method: "POST",
      });
    } finally {
      localStorage.removeItem("laravel_token");
    }
  }
}

export const apiClient = new ApiClient();
