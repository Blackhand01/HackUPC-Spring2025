'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plane, LogOut, Home, Users, PlaneTakeoff, User } from 'lucide-react'; // Added User icon
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
        <nav className="flex flex-1 items-center space-x-1 md:space-x-2 justify-end"> {/* Reduced spacing slightly */}
          {/* Conditional links based on authentication */}
          {isAuthenticated ? (
            <>
              <Link href="/matches">
                 <Button variant="ghost" size="sm" className="px-2 md:px-3"> {/* Adjusted padding */}
                    <PlaneTakeoff className="mr-1 md:mr-2 h-4 w-4" /> {/* Icon for travels */}
                    <span className="hidden md:inline">My Travels</span>
                     <span className="md:hidden">Travels</span> {/* Short label for mobile */}
                 </Button>
              </Link>
               <Link href="/groups">
                 <Button variant="ghost" size="sm" className="px-2 md:px-3"> {/* Adjusted padding */}
                    <Users className="mr-1 md:mr-2 h-4 w-4" /> {/* Icon for groups */}
                    <span className="hidden md:inline">Groups</span>
                     <span className="md:hidden">Groups</span> {/* Short label for mobile */}
                 </Button>
              </Link>
               <Link href="/properties">
                 <Button variant="ghost" size="sm" className="px-2 md:px-3"> {/* Adjusted padding */}
                    <Home className="mr-1 md:mr-2 h-4 w-4" />
                    <span className="hidden md:inline">Properties</span>
                    <span className="md:hidden">Homes</span> {/* Short label for mobile */}
                 </Button>
              </Link>
              <Link href="/profile"> {/* Added Profile Link */}
                 <Button variant="ghost" size="sm" className="px-2 md:px-3"> {/* Adjusted padding */}
                    <User className="mr-1 md:mr-2 h-4 w-4" />
                    <span className="hidden md:inline">Profile</span>
                     <span className="md:hidden">Profile</span> {/* Short label for mobile */}
                 </Button>
              </Link>
              <Button onClick={handleLogout} variant="outline" size="sm" className="px-2 md:px-3"> {/* Adjusted padding */}
                <LogOut className="mr-1 md:mr-2 h-4 w-4" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <>
              {/* Logged-out users only see Log In and Sign Up */}
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
