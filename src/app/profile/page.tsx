
// src/app/profile/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, MessageSquare, Star, Leaf, Inbox } from 'lucide-react';
import { ReviewCard } from '@/components/profile/ReviewCard'; // Import the new component
import { useToast } from '@/hooks/use-toast';

// Define the structure for a Review based on Firestore schema
// Consider moving this to a shared types file (e.g., src/types/index.ts)
export interface Review {
  id: string; // Firestore document ID
  reviewerId: string;
  reviewedUserId: string;
  tripId: string;
  rating: number; // 1-5
  co2Emissions: number; // kg CO2e
  description: string;
  createdAt: Timestamp;
  // Optional fields you might add later for performance/display
  // reviewerDisplayName?: string;
  // reviewerAvatarUrl?: string;
  // reviewedUserDisplayName?: string;
}

export default function ProfilePage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [reviewsReceived, setReviewsReceived] = useState<Review[]>([]);
  const [reviewsGiven, setReviewsGiven] = useState<Review[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [loadingGiven, setLoadingGiven] = useState(true);

  // --- Authentication Check ---
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // --- Fetch Reviews Received ---
  const fetchReviewsReceived = useCallback(async () => {
    if (user?.uid) {
      setLoadingReceived(true);
      try {
        const reviewsCollection = collection(db, 'reviews');
        const q = query(
          reviewsCollection,
          where('reviewedUserId', '==', user.uid),
          orderBy('createdAt', 'desc') // Sort by most recent
        );
        const querySnapshot = await getDocs(q);
        const reviewsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Review[];
        setReviewsReceived(reviewsList);
      } catch (error) {
        console.error('Error fetching received reviews:', error);
        toast({
          variant: 'destructive',
          title: 'Error Fetching Reviews',
          description: 'Could not load received reviews. Please try again later.',
        });
      } finally {
        setLoadingReceived(false);
      }
    } else if (!authLoading) {
      setLoadingReceived(false);
    }
  }, [user, authLoading, toast]);

  // --- Fetch Reviews Given ---
  const fetchReviewsGiven = useCallback(async () => {
    if (user?.uid) {
      setLoadingGiven(true);
      try {
        const reviewsCollection = collection(db, 'reviews');
        const q = query(
          reviewsCollection,
          where('reviewerId', '==', user.uid),
           orderBy('createdAt', 'desc') // Sort by most recent
        );
        const querySnapshot = await getDocs(q);
        const reviewsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Review[];
        setReviewsGiven(reviewsList);
      } catch (error) {
        console.error('Error fetching given reviews:', error);
        toast({
          variant: 'destructive',
          title: 'Error Fetching Reviews',
          description: 'Could not load reviews you have given. Please try again later.',
        });
      } finally {
        setLoadingGiven(false);
      }
    } else if (!authLoading) {
      setLoadingGiven(false);
    }
  }, [user, authLoading, toast]);

  // --- Initial Data Fetch ---
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      fetchReviewsReceived();
      fetchReviewsGiven();
    }
  }, [user, isAuthenticated, authLoading, fetchReviewsReceived, fetchReviewsGiven]);

  // --- Render Logic ---
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.14)*2)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
     // Should be redirected by the effect, but render nothing or a redirect message as fallback
     return null;
  }

  const isLoading = loadingReceived || loadingGiven;

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex items-center mb-8 gap-4">
        <User className="h-10 w-10 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Your Profile</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <Tabs defaultValue="received" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="received">Reviews Received</TabsTrigger>
          <TabsTrigger value="given">Reviews Given</TabsTrigger>
        </TabsList>

        {/* Reviews Received Tab */}
        <TabsContent value="received">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5"/> Reviews About You
              </CardTitle>
              <CardDescription>Feedback from users you've swapped with.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingReceived ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="ml-2 text-muted-foreground">Loading received reviews...</p>
                </div>
              ) : reviewsReceived.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-4" />
                  <p>You haven't received any reviews yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviewsReceived.map((review) => (
                    <ReviewCard key={review.id} review={review} type="received" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reviews Given Tab */}
        <TabsContent value="given">
           <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                 <Star className="h-5 w-5"/> Reviews You've Written
              </CardTitle>
              <CardDescription>Feedback you've provided to other users.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingGiven ? (
                 <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                   <p className="ml-2 text-muted-foreground">Loading given reviews...</p>
                </div>
              ) : reviewsGiven.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-4" />
                  <p>You haven't written any reviews yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviewsGiven.map((review) => (
                     <ReviewCard key={review.id} review={review} type="given" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
