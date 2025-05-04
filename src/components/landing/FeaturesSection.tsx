import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, Users, Plane, CreditCard, MessageCircle } from 'lucide-react';

const features = [
  {
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    title: 'AI-Powered Matching',
    description: 'Our smart AI finds the perfect house swap based on your preferences, personality, and interests.',
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: 'Group Travel Planning',
    description: 'Easily create travel groups, invite friends, and decide on destinations together.',
  },
  {
    icon: <Plane className="h-8 w-8 text-primary" />,
    title: 'Cheapest Flights',
    description: 'Integrated Skyscanner API suggests the most affordable flights for your selected dates.',
  },
  {
    icon: <CreditCard className="h-8 w-8 text-primary" />,
    title: 'Secure Payments',
    description: 'Manage deposits and payouts securely with Revolut integration.',
  },
   {
    icon: <MessageCircle className="h-8 w-8 text-primary" />,
    title: 'Critical Communication',
    description: 'Stay connected with multilingual chat.',
  },
];

export function FeaturesSection() {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          How OnlyFly Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="text-center shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex justify-center mb-4">{feature.icon}</div>
                <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
