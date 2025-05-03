import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plane } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Plane className="h-6 w-6 text-primary" />
          <span className="font-bold sm:inline-block">OnlyFly</span>
        </Link>
        <nav className="flex flex-1 items-center space-x-4 justify-end">
          <Link href="/matches">
             <Button variant="ghost">Find Swaps</Button>
          </Link>
           <Link href="/groups">
             <Button variant="ghost">Groups</Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost">Log In</Button>
          </Link>
          <Link href="/register">
            <Button>Sign Up</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
