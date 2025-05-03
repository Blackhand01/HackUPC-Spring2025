import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <section className="relative h-[60vh] min-h-[400px] flex items-center justify-center text-center bg-secondary">
      <Image
        src="https://picsum.photos/1600/900"
        alt="Beautiful travel destination"
        layout="fill"
        objectFit="cover"
        className="opacity-30"
        priority
        data-ai-hint="travel destination landscape"
      />
      <div className="relative z-10 p-4 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-bold mb-4 text-primary-foreground mix-blend-screen bg-background p-2 rounded">
          Travel the World, Swap Your Home
        </h1>
        <p className="text-lg md:text-xl mb-8 text-primary-foreground mix-blend-screen bg-background p-2 rounded">
          OnlyFly: The AI-powered platform connecting you to global house swaps, minimizing travel costs.
        </p>
        <Link href="/register">
          <Button size="lg">Get Started</Button>
        </Link>
      </div>
    </section>
  );
}
