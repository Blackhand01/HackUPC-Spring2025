'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Initialize state from localStorage if available, otherwise default to false
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
     // Check if window is defined (runs only on client-side)
    if (typeof window !== 'undefined') {
      const storedAuthState = localStorage.getItem('isAuthenticated');
      return storedAuthState ? JSON.parse(storedAuthState) : false;
    }
    return false; // Default to false during server-side rendering
  });

   // Update localStorage whenever isAuthenticated changes
   useEffect(() => {
     if (typeof window !== 'undefined') {
       localStorage.setItem('isAuthenticated', JSON.stringify(isAuthenticated));
     }
   }, [isAuthenticated]);

  const login = () => {
    console.log("Setting isAuthenticated to true");
    setIsAuthenticated(true);
  };

  const logout = () => {
     console.log("Setting isAuthenticated to false");
    setIsAuthenticated(false);
    // Optionally clear other user-related data from storage here
     if (typeof window !== 'undefined') {
       localStorage.removeItem('isAuthenticated'); // Explicitly remove on logout
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
