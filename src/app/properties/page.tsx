'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Home, MapPin, ListChecks, CircleHelp, Leaf } from 'lucide-react';

// Define the schema for a single property based on Firestore structure
interface Property {
  id?: string; // Firestore document ID
  hostId: string;
  title: string;
  address: {
    city: string;
    country: string;
    coordinates?: { lat: number | null; lng: number | null };
  };
  description: string;
  amenities: string[];
  rules: string[];
  greenScore: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  images: {
    imageId: string;
    description: string;
    order: number;
    storagePath: string | null;
  }[];
}

// Define Zod schema for form validation
const propertyFormSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  city: z.string().min(2, 'City is required'),
  country: z.string().min(2, 'Country is required'),
  amenities: z.string().optional(), // Comma-separated string
  rules: z.string().optional(), // Comma-separated string
  greenScore: z.coerce.number().min(0).max(100).optional().default(0),
  lat: z.coerce.number().optional().nullable(),
  lng: z.coerce.number().optional().nullable(),
});

type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export default function PropertiesPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      title: '',
      description: '',
      city: '',
      country: '',
      amenities: '',
      rules: '',
      greenScore: 0,
      lat: null,
      lng: null,
    },
  });

  // Effect for Authentication Check
  useEffect(() => {
    // Wait until auth loading is complete before checking authentication
    if (!authLoading) {
        if (!isAuthenticated) {
            // console.log("PropertiesPage: User not authenticated, redirecting to /login");
            router.push('/login');
        } else {
            // console.log("PropertiesPage: User is authenticated.");
        }
    } else {
        // console.log("PropertiesPage: Auth state still loading...");
    }
  }, [authLoading, isAuthenticated, router]);


  // Effect for Fetching Properties
  useEffect(() => {
    const fetchProperties = async () => {
      if (user?.uid) {
        // console.log(`PropertiesPage: Fetching properties for user ${user.uid}`);
        setLoadingProperties(true);
        try {
          const propertiesCollection = collection(db, 'properties');
          const q = query(propertiesCollection, where('hostId', '==', user.uid));
          const querySnapshot = await getDocs(q);
          const propertiesList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Property[];
          // console.log(`PropertiesPage: Fetched ${propertiesList.length} properties.`);
          setProperties(propertiesList);
        } catch (error) {
          console.error('Error fetching properties:', error);
          toast({
            variant: 'destructive',
            title: 'Error Fetching Properties',
            description: 'Could not load your properties. Please try again later.',
          });
        } finally {
          setLoadingProperties(false);
        }
      } else if (!authLoading) {
        // If auth is done loading and there's no user, stop loading properties
        // console.log("PropertiesPage: No user ID found after auth load, skipping property fetch.");
        setLoadingProperties(false);
      }
    };

    // Only fetch if authenticated and auth loading is complete
    if (!authLoading && isAuthenticated && user) {
      fetchProperties();
    } else if (!authLoading && !isAuthenticated) {
        // If not authenticated after loading, ensure loading state is false
        setLoadingProperties(false);
    }
  }, [user, isAuthenticated, authLoading, toast]); // Dependencies updated

  const onSubmit: SubmitHandler<PropertyFormValues> = async (data) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to add a property.' });
        return;
    }
    setIsSubmitting(true);
    // console.log("PropertiesPage: Submitting new property data:", data);

    try {
      const propertyToAdd: Omit<Property, 'id'> = {
        hostId: user.uid,
        title: data.title,
        address: {
          city: data.city,
          country: data.country,
          coordinates: {
            lat: data.lat ?? null,
            lng: data.lng ?? null,
          },
        },
        description: data.description,
        amenities: data.amenities?.split(',').map(item => item.trim()).filter(Boolean) || [],
        rules: data.rules?.split(',').map(item => item.trim()).filter(Boolean) || [],
        greenScore: data.greenScore || 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        images: [], // Start with empty images array
      };

      const docRef = await addDoc(collection(db, 'properties'), propertyToAdd);
      // console.log("PropertiesPage: Property added with ID:", docRef.id);
      toast({
        title: 'Property Added!',
        description: `Your property "${data.title}" has been successfully added.`,
      });

      // Add the new property to the local state immediately for better UX
      setProperties(prev => [...prev, { ...propertyToAdd, id: docRef.id, createdAt: propertyToAdd.createdAt, updatedAt: propertyToAdd.updatedAt }]);

      form.reset(); // Reset the form
      setIsAddDialogOpen(false); // Close the dialog

    } catch (error) {
      console.error('Error adding property:', error);
      toast({
        variant: 'destructive',
        title: 'Error Adding Property',
        description: 'Failed to add property. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Centralized Loading/Redirect Logic
  if (authLoading) {
    // console.log("PropertiesPage: Showing loading spinner (authLoading)");
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  // If loading is complete but user is not authenticated, the useEffect hook will handle the redirect.
  // We can optionally show a "Redirecting..." message or the spinner again briefly.
  if (!isAuthenticated) {
    // console.log("PropertiesPage: Showing loading spinner (redirecting)");
     // Or return null, or a "Redirecting..." message
     return (
        <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="ml-4">Redirecting to login...</p>
        </div>
    );
  }

  // If authenticated, render the page content
  // console.log("PropertiesPage: Rendering page content for authenticated user.");
  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Properties</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Add a New Property</DialogTitle>
              <DialogDescription>
                Fill in the details of the property you want to list for swapping.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-4">
              {/* Title */}
              <div className="space-y-2">
                 <Label htmlFor="title" className="flex items-center gap-1"><Home className="h-4 w-4"/>Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Cozy Beachfront Condo"
                  {...form.register('title')}
                   aria-invalid={form.formState.errors.title ? 'true' : 'false'}
                   disabled={isSubmitting}
                />
                {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center gap-1"><Home className="h-4 w-4"/>Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your property, its features, and the neighborhood."
                  {...form.register('description')}
                  rows={4}
                   aria-invalid={form.formState.errors.description ? 'true' : 'false'}
                   disabled={isSubmitting}
                />
                {form.formState.errors.description && <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>}
              </div>

              {/* Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label htmlFor="city" className="flex items-center gap-1"><MapPin className="h-4 w-4"/>City</Label>
                  <Input id="city" placeholder="e.g., Barcelona" {...form.register('city')} aria-invalid={form.formState.errors.city ? 'true' : 'false'} disabled={isSubmitting}/>
                  {form.formState.errors.city && <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>}
                </div>
                <div className="space-y-2">
                   <Label htmlFor="country" className="flex items-center gap-1"><MapPin className="h-4 w-4"/>Country</Label>
                  <Input id="country" placeholder="e.g., Spain" {...form.register('country')} aria-invalid={form.formState.errors.country ? 'true' : 'false'} disabled={isSubmitting}/>
                  {form.formState.errors.country && <p className="text-sm text-destructive">{form.formState.errors.country.message}</p>}
                </div>
              </div>

                {/* Coordinates (Optional) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="lat" className="flex items-center gap-1"><MapPin className="h-4 w-4"/>Latitude (Optional)</Label>
                   <Input id="lat" type="number" step="any" placeholder="e.g., 41.3851" {...form.register('lat')} disabled={isSubmitting} />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="lng" className="flex items-center gap-1"><MapPin className="h-4 w-4"/>Longitude (Optional)</Label>
                   <Input id="lng" type="number" step="any" placeholder="e.g., 2.1734" {...form.register('lng')} disabled={isSubmitting} />
                 </div>
               </div>


              {/* Amenities */}
              <div className="space-y-2">
                <Label htmlFor="amenities" className="flex items-center gap-1"><ListChecks className="h-4 w-4"/>Amenities (comma-separated)</Label>
                <Input
                  id="amenities"
                  placeholder="e.g., WiFi, Air conditioning, Kitchen, Pool"
                  {...form.register('amenities')}
                  disabled={isSubmitting}
                />
              </div>

              {/* Rules */}
              <div className="space-y-2">
                <Label htmlFor="rules" className="flex items-center gap-1"><CircleHelp className="h-4 w-4"/>House Rules (comma-separated)</Label>
                <Input
                  id="rules"
                  placeholder="e.g., No smoking, No parties, Pets allowed"
                  {...form.register('rules')}
                  disabled={isSubmitting}
                />
              </div>

               {/* Green Score */}
                <div className="space-y-2">
                  <Label htmlFor="greenScore" className="flex items-center gap-1"><Leaf className="h-4 w-4"/>Green Score (0-100, Optional)</Label>
                  <Input
                    id="greenScore"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g., 85"
                    {...form.register('greenScore')}
                    disabled={isSubmitting}
                  />
                  {form.formState.errors.greenScore && <p className="text-sm text-destructive">{form.formState.errors.greenScore.message}</p>}
                </div>


              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Adding...' : 'Add Property'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Display Properties */}
      {loadingProperties ? (
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your properties...</p>
        </div>
      ) : properties.length === 0 ? (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
             <Home className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>No Properties Listed Yet</CardTitle>
            <CardDescription>Add your first property to start swapping!</CardDescription>
          </CardHeader>
          <CardContent>
             <Button onClick={() => setIsAddDialogOpen(true)}> {/* Changed DialogTrigger to simple Button */}
               <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Property
             </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <Card key={property.id} className="shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col">
              <CardHeader>
                <CardTitle>{property.title}</CardTitle>
                <CardDescription>
                  <MapPin className="inline-block h-4 w-4 mr-1" />
                  {property.address.city}, {property.address.country}
                </CardDescription>
                 {property.greenScore > 0 && (
                   <div className="mt-2 flex items-center text-sm text-green-600">
                    <Leaf className="h-4 w-4 mr-1" /> Green Score: {property.greenScore}
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">{property.description}</p>
                {property.amenities.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Amenities</h4>
                    <div className="flex flex-wrap gap-1">
                      {property.amenities.slice(0, 4).map((amenity, index) => ( // Show max 4 amenities
                        <span key={index} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{amenity}</span>
                      ))}
                       {property.amenities.length > 4 && <span className="text-xs text-muted-foreground">...</span>}
                    </div>
                  </div>
                )}
                 {/* Optionally display rules or other details */}
              </CardContent>
               <CardFooter className="flex justify-end pt-4">
                  {/* Add Edit/Delete buttons later */}
                  <Button variant="outline" size="sm">View Details</Button>
               </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
