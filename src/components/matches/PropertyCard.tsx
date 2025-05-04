// src/components/matches/PropertyCard.tsx
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ListChecks, Leaf, Home as HomeIcon } from 'lucide-react'; // Renamed Home to HomeIcon
import { type Property } from "@/types";
import Image from 'next/image'; // Use next/image for potential future images

interface PropertyCardProps {
  property: Property;
}

export function PropertyCard({ property }: PropertyCardProps) {
    // Placeholder image - replace with actual image logic later if needed
    const placeholderImage = "https://picsum.photos/300/200";
    const hasCoordinates = property.address.coordinates?.lat && property.address.coordinates?.lng;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
        {/* Image Placeholder */}
        <div className="relative h-40 w-full bg-muted overflow-hidden rounded-t-lg">
            <Image
                src={placeholderImage}
                alt={`Image of ${property.title}`}
                fill
                style={{ objectFit: 'cover' }}
                data-ai-hint="house exterior interior" // AI hint for image generation
            />
        </div>
      <CardHeader className="pt-4 pb-2">
        <CardTitle className="text-lg leading-tight">{property.title}</CardTitle>
        <CardDescription className="text-xs flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {property.address.city}, {property.address.country}
          {property.address.nearestAirportIata && ` (${property.address.nearestAirportIata})`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow py-2 text-sm space-y-2">
        <p className="text-muted-foreground line-clamp-2">{property.description}</p>
        {property.amenities.length > 0 && (
          <div className="flex items-start gap-1 pt-1">
            <ListChecks className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
            <div className="flex flex-wrap gap-1">
              {property.amenities.slice(0, 3).map((amenity, index) => (
                <span key={index} className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full">{amenity}</span>
              ))}
              {property.amenities.length > 3 && <span className="text-xs text-muted-foreground">...</span>}
            </div>
          </div>
        )}
         {property.greenScore > 0 && (
           <div className="flex items-center text-xs text-green-600 gap-1">
            <Leaf className="h-3 w-3" /> Green Score: {property.greenScore}
          </div>
        )}
         {hasCoordinates && (
            <p className="text-xs text-muted-foreground">Lat: {property.address.coordinates?.lat?.toFixed(4)}, Lng: {property.address.coordinates?.lng?.toFixed(4)}</p>
         )}
      </CardContent>
      <CardFooter className="pt-3 pb-4 flex justify-end">
        {/* Add actions like "Request Swap" later */}
        <Button variant="outline" size="sm">View Details</Button>
      </CardFooter>
    </Card>
  );
}
