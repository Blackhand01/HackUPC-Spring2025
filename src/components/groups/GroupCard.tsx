// src/components/groups/GroupCard.tsx
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Users, Link as LinkIcon, Share2, PlaneTakeoff, Calendar, Heart, MapPin, Smile, Mountain, Film, Utensils, Leaf, CalendarDays, Info, LocateFixed } from 'lucide-react';
import { CopyToClipboard } from '@/components/functional/CopyToClipboard';
import { format } from 'date-fns';
import { type Group, type Travel } from '@/types';
import { useRouter } from 'next/navigation';

interface GroupCardProps {
    group: Group;
    travels: Travel[];
    isLoadingTravels: boolean;
    generateInviteLink: (groupId: string) => string;
    shareOnWhatsApp: (link: string, groupName: string) => void;
    shareOnTelegram: (link: string, groupName: string) => void;
}

// Helper to parse preferences
const getPreference = (preferences: string[] | undefined, key: string): string | undefined => {
    if (!preferences) return undefined;
    const pref = preferences.find(p => p.startsWith(`${key}:`));
    return pref ? pref.split(':').slice(1).join(':') : undefined;
};

const getPreferenceIcon = (key: string, value: string | undefined): React.ReactNode => {
    if (!value) return null;
    if (key === 'mood') {
        switch (value) {
            case 'relaxed': return <Smile className="h-4 w-4 text-primary"/>;
            case 'adventurous': return <Mountain className="h-4 w-4 text-primary"/>;
            case 'cultural': return <Film className="h-4 w-4 text-primary"/>;
            case 'social': return <Users className="h-4 w-4 text-primary"/>;
            case 'nature': return <Leaf className="h-4 w-4 text-primary"/>;
            default: return <Heart className="h-4 w-4 text-primary"/>;
        }
    }
    if (key === 'activity') {
         if (value.startsWith('other:')) return <Info className="h-4 w-4 text-primary"/>;
        switch (value) {
            case 'hiking': return <Mountain className="h-4 w-4 text-primary"/>;
            case 'museums': return <Film className="h-4 w-4 text-primary"/>;
            case 'beach': return <PlaneTakeoff className="h-4 w-4 text-primary"/>; // Use PlaneTakeoff
            case 'nightlife': return <Users className="h-4 w-4 text-primary"/>;
            case 'foodie': return <Utensils className="h-4 w-4 text-primary"/>;
             case 'other': return <Info className="h-4 w-4 text-primary"/>;
            default: return <Heart className="h-4 w-4 text-primary"/>;
        }
    }
    return null;
};


export function GroupCard({
    group,
    travels,
    isLoadingTravels,
    generateInviteLink,
    shareOnWhatsApp,
    shareOnTelegram,
}: GroupCardProps) {
    const router = useRouter();
    // Ensure group.id exists before generating link or fetching travels
    if (!group.id) {
        console.warn("Rendering group without ID:", group);
        return null; // Skip rendering groups without IDs
    }
    const inviteLink = generateInviteLink(group.id);
    // Safely format creation date
    const formattedCreateDate = group.createAt?.toDate ? group.createAt.toDate().toLocaleDateString() : 'N/A';

    return (
        <Card key={group.id} className="shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="truncate">{group.groupName}</CardTitle>
                        <CardDescription>
                            {group.users?.length ?? 0} member{(group.users?.length ?? 0) !== 1 ? 's' : ''} | Created: {formattedCreateDate}
                        </CardDescription>
                    </div>
                    <div className="flex items-center flex-shrink-0 gap-1 md:gap-2">
                        <CopyToClipboard textToCopy={inviteLink}>
                            <Button variant="outline" size="sm" className="px-2">
                                <LinkIcon className="h-4 w-4 md:mr-1"/>
                                <span className="hidden md:inline">Copy</span>
                            </Button>
                        </CopyToClipboard>
                        <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="px-2"><Share2 className="h-4 w-4 md:mr-1"/>
                                        <span className="hidden md:inline">Share</span>
                                        </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[350px]">
                                    <DialogHeader>
                                        <DialogTitle>Share Invite Link</DialogTitle>
                                        <DialogDescription>Invite others to "{group.groupName}"</DialogDescription>
                                    </DialogHeader>
                                    <div className="flex flex-col gap-3 py-4">
                                        <Input value={inviteLink} readOnly className="text-xs" />
                                            <Button onClick={() => shareOnWhatsApp(inviteLink, group.groupName)} className="bg-green-500 hover:bg-green-600">
                                            Share on WhatsApp
                                        </Button>
                                        <Button onClick={() => shareOnTelegram(inviteLink, group.groupName)} className="bg-blue-500 hover:bg-blue-600">
                                            Share on Telegram
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><PlaneTakeoff className="h-5 w-5 text-primary"/>Associated Trips</h3>
                    {isLoadingTravels ? (
                        <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground text-sm">Loading trips...</span>
                        </div>
                    ) : travels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No trips planned for this group yet.</p>
                    ) : (
                        <div className="space-y-3">
                        {travels.map(travel => {
                                // Ensure travel.id exists before rendering the trip item
                                if (!travel.id) {
                                console.warn("Rendering travel without ID:", travel);
                                return null; // Skip rendering travels without IDs
                            }

                            const mood = getPreference(travel.preferences, 'mood');
                            const activityRaw = getPreference(travel.preferences, 'activity');
                            const activityOther = activityRaw?.startsWith('other:') ? activityRaw.substring(6) : undefined;
                            const activity = activityOther ? `Other (${activityOther})` : activityRaw;


                            return (
                                <div key={travel.id} className="border p-3 rounded-md bg-secondary/50">
                                    <p className="text-sm font-medium text-secondary-foreground mb-1.5">Trip Plan <span className="font-mono text-xs bg-background px-1 py-0.5 rounded">#{travel.id?.substring(0, 6)}</span></p>
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                            <p className="flex items-center gap-1">
                                                <LocateFixed className="h-3 w-3"/>
                                                Departing from: <span className="font-medium text-foreground">{travel.departureCity || 'N/A'}</span>
                                                {travel.departureCityIata && <span className="text-xs bg-muted px-1 py-0.5 rounded">({travel.departureCityIata})</span>}
                                            </p>
                                        {mood && (
                                            <p className="flex items-center gap-1 capitalize">
                                                {getPreferenceIcon('mood', mood)} Mood: <span className="font-medium text-foreground">{mood}</span>
                                            </p>
                                        )}
                                        {activity && (
                                            <p className="flex items-center gap-1 capitalize">
                                                {getPreferenceIcon('activity', activityRaw)} Activity: <span className="font-medium text-foreground">{activity}</span>
                                            </p>
                                        )}
                                        {travel.preferences?.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 0 && (
                                            <div className="flex items-start gap-1 pt-1">
                                                <Heart className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary"/>
                                                <div className="flex flex-wrap gap-1">
                                                    {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).slice(0, 4).map((pref, index) => (
                                                        <span key={index} className="text-xs bg-background text-foreground px-1.5 py-0.5 rounded-full">{pref}</span>
                                                    ))}
                                                    {travel.preferences.filter(p => !p.startsWith('mood:') && !p.startsWith('activity:')).length > 4 && <span className="text-xs text-muted-foreground">...</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                    )}
            </CardContent>
                <CardFooter className="flex justify-end pt-4 border-t mt-4">
                    {/* Redirect to matches page with groupId to pre-select the group */}
                    <Button variant="secondary" size="sm" onClick={() => router.push(`/matches?groupId=${group.id}`)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Plan Trip for Group
                    </Button>
            </CardFooter>
        </Card>
    );
}
