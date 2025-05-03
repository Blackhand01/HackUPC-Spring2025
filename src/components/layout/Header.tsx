'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plane, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export function Header() {
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/'); // Redirect to home page after logout
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Plane className="h-6 w-6 text-primary" />
          <span className="font-bold sm:inline-block">OnlyFly</span>
        </Link>
        <nav className="flex flex-1 items-center space-x-2 md:space-x-4 justify-end">
          {/* Always visible links */}
          <Link href="/matches">
             <Button variant="ghost" size="sm" className="px-2 md:px-4">Find Swaps</Button>
          </Link>
           <Link href="/groups">
             <Button variant="ghost" size="sm" className="px-2 md:px-4">Groups</Button>
          </Link>

          {/* Conditional links */}
          {isAuthenticated ? (
            <Button onClick={handleLogout} variant="outline" size="sm" className="px-2 md:px-4">
              <LogOut className="mr-0 md:mr-2 h-4 w-4" />
              <span className="hidden md:inline">Sign Out</span>
            </Button>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="px-2 md:px-4">Log In</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="px-2 md:px-4">Sign Up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
