import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';

export default function GroupsPage() {
  // Placeholder data - Replace with actual group data fetching
  const groups = [
    { id: '1', name: 'Summer Europe Trip', members: 4, destination: 'Paris, France' },
    { id: '2', name: 'Ski Weekend Crew', members: 6, destination: 'Aspen, CO' },
    { id: '3', name: 'Asia Adventure', members: 3, destination: 'Tokyo, Japan' },
  ];

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Travel Groups</h1>
        <Button>
          <Users className="mr-2 h-4 w-4" /> Create New Group
        </Button>
      </div>

      {groups.length === 0 ? (
         <Card className="text-center py-12">
          <CardHeader>
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <CardTitle>No Groups Yet</CardTitle>
            <CardDescription>Start planning your next adventure by creating a travel group!</CardDescription>
          </CardHeader>
          <CardContent>
             <Button>Create Your First Group</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Card key={group.id} className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle>{group.name}</CardTitle>
                <CardDescription>Destination: {group.destination}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{group.members} members</p>
                 <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm">View Group</Button>
                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
