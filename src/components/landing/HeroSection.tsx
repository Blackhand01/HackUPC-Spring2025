import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <section className="relative h-[60vh] min-h-[400px] flex items-center justify-center text-center bg-secondary">
      <Image
        src="https://picsum.photos/1600/900"
        alt="Beautiful travel destination"
        fill // Changed layout to fill for better responsiveness
        objectFit="cover"
        className="opacity-40" // Slightly increased opacity for better visibility of text
        priority
        data-ai-hint="travel destination landscape"
      />
      <div className="relative z-10 p-4 max-w-3xl mx-auto">
        {/* Removed mix-blend-screen, bg-background, p-2, rounded and changed text color */}
        <h1 className="text-4xl md:text-6xl font-bold mb-4 text-foreground drop-shadow-md">
          Travel the World, Swap Your Home
        </h1>
        {/* Adjusted paragraph text color and added subtle background for readability */}
        <p className="text-lg md:text-xl mb-8 text-foreground/90 bg-background/70 p-2 rounded-md shadow-sm">
          OnlyFly: The AI-powered platform connecting you to global house swaps, minimizing travel costs.
        </p>
        <Link href="/register">
          <Button size="lg">Get Started</Button>
        </Link>
      </div>
    </section>
  );
}
