
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
  signup: (email: string, password: string) => Promise<void>; // Removed role from signup signature for simplicity
  logout: () => Promise<void>;
  hasAccess: (requiredRole: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Start loading

  useEffect(() => {
    // Always listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setIsAuthenticated(true);
        setUser(currentUser);

        // Fetch or determine role (using cookie if available, else default)
        const userRole = getCookie('userRole') as string || 'user'; // Prioritize cookie, fallback to 'user'
        setRole(userRole);

        // Ensure cookies are set/updated
        setCookie('sessionToken', currentUser.uid, { path: '/', sameSite: 'lax', maxAge: 3600 });
        setCookie('userRole', userRole, { path: '/', sameSite: 'lax', maxAge: 3600 });
        // Optionally save role to localStorage if needed elsewhere, but cookie is primary
        localStorage.setItem('userRole', userRole);

        console.log("Auth State Changed: User Logged In", currentUser.uid, "Role:", userRole);

      } else {
        setIsAuthenticated(false);
        setUser(null);
        setRole(null);

        // Clear cookies and local storage on logout
        deleteCookie('sessionToken', { path: '/' });
        deleteCookie('userRole', { path: '/' });
        localStorage.removeItem('userRole');
        console.log("Auth State Changed: User Logged Out");
      }
      setLoading(false); // Set loading to false once auth state is determined
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs once on mount


  // Simplified signup - role is handled implicitly as 'user' for now
   const signup = async (email: string, password: string) => {
    setLoading(true); // Indicate loading state during signup
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      const defaultRole = 'user'; // Assign default role

      // Set state immediately after signup
      setUser(newUser);
      setIsAuthenticated(true);
      setRole(defaultRole);

      // Set cookies and localStorage
      setCookie('sessionToken', newUser.uid, { path: '/', sameSite: 'lax', maxAge: 3600 });
      setCookie('userRole', defaultRole, { path: '/', sameSite: 'lax', maxAge: 3600 });
      localStorage.setItem('userRole', defaultRole);

      console.log("Signup successful:", newUser.uid, "Role:", defaultRole);
    } catch (error: any) {
      console.error("Error signing up:", error.message);
      // Reset state on error? Maybe not, let the form handle UI feedback
      setLoading(false);
      throw error; // Re-throw error for form handling
    }
    // setLoading(false) will be called by the onAuthStateChanged listener
  };

  const login = async (email: string, password: string) => {
    setLoading(true); // Indicate loading state during login
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;

      // Role determination happens within onAuthStateChanged listener now
      // We don't need to manually set state here as the listener will handle it.
      console.log("Login attempt successful for:", loggedInUser.uid);

    } catch (error: any) {
      console.error("Error logging in:", error.message);
      // Reset state on error? Maybe not, let the form handle UI feedback
      setIsAuthenticated(false); // Ensure state reflects failed login attempt
      setUser(null);
      setRole(null);
      setLoading(false); // Set loading false on login error
      throw error; // Re-throw error for form handling
    }
     // setLoading(false) will be called by the onAuthStateChanged listener upon successful login
  };


  const logout = async () => {
    setLoading(true); // Indicate loading state during logout
    try {
      await signOut(auth);
      // State clearing and cookie deletion are handled by the onAuthStateChanged listener
      console.log("Logout successful");
    } catch (error: any) {
      console.error("Error logging out:", error.message);
      setLoading(false); // Ensure loading is false even if logout fails
      throw error;
    }
     // setLoading(false) will be called by the onAuthStateChanged listener
  };

  // Role check remains the same
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

