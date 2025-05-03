// src/components/profile/ReviewCard.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Leaf, User, Calendar } from "lucide-react";
import { type Review } from "@/types"; // Import shared Review type
import { format } from 'date-fns';

interface ReviewCardProps {
  review: Review;
  type: 'received' | 'given';
}

// Helper to render stars
const renderStars = (rating: number) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`h-4 w-4 ${i <= rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
      />
    );
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
};

export function ReviewCard({ review, type }: ReviewCardProps) {
  const formattedDate = review.createdAt?.toDate ? format(review.createdAt.toDate(), "PPP") : 'Date unavailable';

  // In a real app, you'd fetch user details based on reviewerId/reviewedUserId
  const userIdentifier = type === 'received'
    ? `From User: ${review.reviewerId.substring(0, 6)}...` // Placeholder
    : `To User: ${review.reviewedUserId.substring(0, 6)}...`; // Placeholder

  return (
    <Card className="bg-secondary/30 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <div>
             <CardTitle className="text-base font-medium flex items-center gap-1.5">
                <User className="h-4 w-4 text-muted-foreground"/> {userIdentifier}
            </CardTitle>
            <CardDescription className="text-xs mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3"/> {formattedDate}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {renderStars(review.rating)}
             <div className="flex items-center text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full" title={`CO₂ Emissions: ${review.co2Emissions} kg CO₂e`}>
                 <Leaf className="h-3 w-3 mr-1" />
                 {review.co2Emissions} kg
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground">{review.description}</p>
        {/* Optionally add a link to the trip details: */}
        {/* <p className="text-xs text-muted-foreground mt-2">Trip ID: {review.tripId.substring(0, 8)}...</p> */}
      </CardContent>
    </Card>
  );
}
