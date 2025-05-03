"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { setCookie, deleteCookie, getCookie } from 'cookies-next';
import { auth } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  role: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  hasAccess: (requiredRole: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionToken = getCookie('sessionToken');
    const userRole = getCookie('userRole');

    if (sessionToken && userRole) {
      // Restore session from cookies
      setIsAuthenticated(true);
      setRole(userRole as string);
      setLoading(false);
    } else {
      // Listen for Firebase auth state changes
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setIsAuthenticated(true);
          setUser(user);

          // Fetch role from a database or local storage
          const userRole = localStorage.getItem('userRole') || 'user';
          setRole(userRole);

          setCookie('sessionToken', user.uid, { path: '/', sameSite: 'lax', maxAge: 3600 });
          setCookie('userRole', userRole, { path: '/', sameSite: 'lax', maxAge: 3600 });
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setRole(null);

          deleteCookie('sessionToken', { path: '/' });
          deleteCookie('userRole', { path: '/' });
        }
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, []);

  const signup = async (email: string, password: string, role: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save role to cookies and local storage
      setCookie('sessionToken', user.uid, { path: '/', sameSite: 'lax', maxAge: 3600 });
      setCookie('userRole', role, { path: '/', sameSite: 'lax', maxAge: 3600 });
      localStorage.setItem('userRole', role);

      setRole(role);
      setIsAuthenticated(true);
      setUser(user);
    } catch (error: any) {
      console.error("Error signing up:", error.message);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Fetch role from a database or local storage
      const userRole = localStorage.getItem('userRole') || 'user';

      // Save session token and role to cookies
      setCookie('sessionToken', user.uid, { path: '/', sameSite: 'lax', maxAge: 3600 });
      setCookie('userRole', userRole, { path: '/', sameSite: 'lax', maxAge: 3600 });

      setRole(userRole);
      setIsAuthenticated(true);
      setUser(user);
    } catch (error: any) {
      console.error("Error logging in:", error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);

      setIsAuthenticated(false);
      setUser(null);
      setRole(null);

      deleteCookie('sessionToken', { path: '/' });
      deleteCookie('userRole', { path: '/' });
      localStorage.removeItem('userRole');
    } catch (error: any) {
      console.error("Error logging out:", error.message);
      throw error;
    }
  };

  const hasAccess = (requiredRole: string): boolean => {
    return role === requiredRole;
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, role, loading, login, signup, logout, hasAccess }}>
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
