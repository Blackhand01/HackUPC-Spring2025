"use client";
// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { setCookie, deleteCookie, getCookie } from 'cookies-next'; // Assuming you are using cookies-next
import { auth } from '@/lib/firebase'; // Import your initialized Firebase auth instance
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User // Import User type if needed for type hinting
} from 'firebase/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null; // Add user to context
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>; // Add signup function
  logout: () => Promise<void>; // Logout should also return a Promise
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null); // State to hold the authenticated user

  useEffect(() => {
    // Listen for changes in authentication state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        setIsAuthenticated(true);
        setUser(user);
        // Set a session cookie to be read by the middleware
        if (typeof window !== 'undefined') {
           setCookie('sessionToken', user.uid, { path: '/', sameSite: 'lax' }); // Uncommented and added options
           localStorage.setItem('isAuthenticated', 'true');
        }
      } else {
        // User is signed out
        setIsAuthenticated(false);
        setUser(null);
        if (typeof window !== 'undefined') {
           deleteCookie('sessionToken', { path: '/' }); // Ensure path is correct for deletion
           localStorage.removeItem('isAuthenticated');
        }
      }
    });

    // Clean up the listener on unmount
    return () => unsubscribe();
  }, []);

  const signup = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // User signed up and logged in automatically by Firebase
    } catch (error: any) {
      console.error("Error signing up:", error.message);
      throw error; // Re-throw the error to be handled by the calling component
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // User logged in
    } catch (error: any) {
      console.error("Error logging in:", error.message);
      throw error; // Re-throw the error
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      // User logged out
    } catch (error: any) {
      console.error("Error logging out:", error.message);
      throw error; // Re-throw the error
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, signup, logout }}>
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
