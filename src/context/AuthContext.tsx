// src/context/AuthContext.tsx
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to set a cookie
const setCookie = (name: string, value: string, days: number) => {
  if (typeof window === 'undefined') return; // Ensure running on client
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
};

// Helper function to delete a cookie
const deleteCookie = (name: string) => {
   if (typeof window === 'undefined') return; // Ensure running on client
  // Set the cookie to expire in the past
  document.cookie = name + '=; Max-Age=-99999999; path=/';
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      // Check cookie first for server/client consistency in middleware
      const cookieExists = document.cookie.split(';').some((item) => item.trim().startsWith('sessionToken='));
      if (cookieExists) return true;

      // Fallback to localStorage (primarily for client-side persistence if cookie logic fails)
      const storedAuthState = localStorage.getItem('isAuthenticated');
      if (storedAuthState) {
         const parsedState = JSON.parse(storedAuthState);
         // If localStorage says authenticated but cookie doesn't exist, update cookie
         if(parsedState) setCookie('sessionToken', 'simulated-token', 1); // Set cookie if localStorage says logged in
         return parsedState;
      }
       // If neither cookie nor localStorage indicates authentication, ensure cookie is removed
       deleteCookie('sessionToken');
    }
    return false; // Default to false during SSR or if neither state exists
  });

  // Update localStorage whenever isAuthenticated changes (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('isAuthenticated', JSON.stringify(isAuthenticated));
       // Ensure cookie matches state
       if (isAuthenticated && !document.cookie.split(';').some((item) => item.trim().startsWith('sessionToken='))) {
         setCookie('sessionToken', 'simulated-token', 1); // Set if state is true but cookie missing
       } else if (!isAuthenticated && document.cookie.split(';').some((item) => item.trim().startsWith('sessionToken='))) {
          deleteCookie('sessionToken'); // Delete if state is false but cookie exists
       }
    }
  }, [isAuthenticated]);

  const login = () => {
    console.log("Setting isAuthenticated to true and setting cookie");
    setCookie('sessionToken', 'simulated-token', 1); // Set a dummy session token cookie for middleware check
    setIsAuthenticated(true);
  };

  const logout = () => {
    console.log("Setting isAuthenticated to false and removing cookie");
    deleteCookie('sessionToken'); // Remove the session token cookie
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isAuthenticated');
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
