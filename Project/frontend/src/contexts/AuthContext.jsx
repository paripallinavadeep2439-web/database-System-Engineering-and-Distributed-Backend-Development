import { createContext, useContext, useState, useCallback, useEffect } from "react";
import * as api from "../services/api";

const AuthContext = createContext(null);
const TOKEN_KEY = "pharmastock.token";
const USER_KEY = "pharmastock.user";

function clearStoredSession() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    return;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let storedToken = null;
    try {
      storedToken = window.localStorage.getItem(TOKEN_KEY);
    } catch {
      clearStoredSession();
    }
    if (!storedToken) {
      setIsLoading(false);
      return () => { active = false; };
    }
    api.getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        window.localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
      })
      .catch(() => {
        if (!active) return;
        clearStoredSession();
        setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.login(email, password);
    window.localStorage.setItem(TOKEN_KEY, response.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);

  const updateCurrentUser = useCallback(async (data) => {
    const updated = await api.updateProfile(data);
    setUser(updated);
    try {
      window.localStorage.setItem(USER_KEY, JSON.stringify(updated));
    } catch {
      return updated;
    }
    return updated;
  }, []);

  const value = { user, login, logout, updateCurrentUser, isAuthenticated: !!user, isLoading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
