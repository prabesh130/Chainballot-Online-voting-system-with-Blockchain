import React, { createContext, useContext, useEffect, useState } from "react";
import { getApiUrl } from "../utils/api";

type LoginResult =
  | { success: true }
  | { otpRequired: true }
  | { error: string };

type User = {
  name: string;
  email: string;
  roll: string;
  is_voted: boolean;
  is_verified: boolean;
};

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyOtp: (email: string, otp: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔁 Check session on page refresh
  const getCSRFToken = () => {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrftoken="))
      ?.split("=")[1];
  };
  useEffect(() => {
    fetch(getApiUrl("/voter/csrf/"), {
      credentials: "include",
    });
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(getApiUrl("/voter/profile/"), {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          console.log("✅ User authenticated:", data);
          setUser(data);
        } else {
          // Not logged in - this is normal, not an error
          console.log("ℹ️ No active session");
          setUser(null);
        }
      } catch (error) {
        // Network error or server down
        console.log("⚠️ Could not check authentication:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (
    email: string,
    password: string,
  ): Promise<LoginResult> => {
    try {
      const res = await fetch(getApiUrl("/voter/login/"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken() || "",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Login failed" };
      }

      if (data.otp_required) {
        return { otpRequired: true };
      }

      return { error: "Unexpected response" };
    } catch {
      return { error: "Server error" };
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    try {
      const res = await fetch(getApiUrl("/voter/verify-otp/"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken() || "",
        },
        body: JSON.stringify({ email, otp }),
      });

      if (!res.ok) return false;

      // ✅ Fetch profile AFTER OTP login
      const profileRes = await fetch(getApiUrl("/voter/profile/"), {
        credentials: "include",
      });

      if (!profileRes.ok) return false;

      const userData = await profileRes.json();
      setUser(userData);
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch(getApiUrl("/voter/logout/"), {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRFToken": getCSRFToken() || "",
        },
      });

      console.log("✅ Logged out successfully");
      setUser(null);
    } catch (error) {
      console.log("⚠️ Logout error:", error);
      // Still clear user even if logout request fails
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, verifyOtp, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
