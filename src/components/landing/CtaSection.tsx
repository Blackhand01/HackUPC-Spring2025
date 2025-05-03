import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function CtaSection() {
  return (
    <section className="py-16 lg:py-24 bg-secondary">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-secondary-foreground">
          Ready to Explore the World?
        </h2>
        <p className="text-lg md:text-xl mb-8 text-secondary-foreground">
          Join OnlyFly today and start planning your next adventure with minimal costs.
        </p>
        <Link href="/register">
          <Button size="lg">Sign Up Now</Button>
        </Link>
      </div>
    </section>
  );
}
