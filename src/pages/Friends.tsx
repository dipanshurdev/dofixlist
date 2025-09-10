import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, UserPlus, Users, TrendingUp, Calendar, Target } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, isToday, isYesterday } from 'date-fns';

interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  user_id: string;
}

interface ActivityItem {
  id: string;
  completion_date: string;
  notes?: string;
  habits: {
    name: string;
    frequency: string;
    categories?: {
      name: string;
      color: string;
    };
  };
  profiles: {
    username: string;
    full_name: string;
  };
}

const Friends = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<Profile[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');

  useEffect(() => {
    fetchFollowing();
    fetchFollowers();
    fetchFriendsActivity();
  }, [user]);

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchQuery}%`)
        .neq('user_id', user?.id)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to search users"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowing = async () => {
    try {
      const { data: follows, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user?.id);

      if (error) throw error;

      if (follows && follows.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', follows.map(f => f.following_id));

        if (profileError) throw profileError;
        setFollowing(profiles || []);
      } else {
        setFollowing([]);
      }
    } catch (error: any) {
      console.error('Error fetching following:', error);
    }
  };

  const fetchFollowers = async () => {
    try {
      const { data: follows, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user?.id);

      if (error) throw error;

      if (follows && follows.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', follows.map(f => f.follower_id));

        if (profileError) throw profileError;
        setFollowers(profiles || []);
      } else {
        setFollowers([]);
      }
    } catch (error: any) {
      console.error('Error fetching followers:', error);
    }
  };

  const fetchFriendsActivity = async () => {
    try {
      // Get IDs of users I'm following
      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user?.id);

      if (followingError) throw followingError;

      const followingIds = followingData?.map(f => f.following_id) || [];
      
      if (followingIds.length === 0) {
        setFriendsActivity([]);
        return;
      }

      // Get recent completions from followed users - simplified approach
      const { data: completions, error } = await supabase
        .from('habit_completions')
        .select('id, completion_date, notes, habit_id, user_id')
        .in('user_id', followingIds)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (completions && completions.length > 0) {
        // Get habit details
        const habitIds = completions.map(c => c.habit_id);
        const { data: habits } = await supabase
          .from('habits')
          .select('id, name, frequency, category_id, categories(name, color)')
          .in('id', habitIds);

        // Get user profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, full_name')
          .in('user_id', followingIds);

        // Combine data
        const activity: ActivityItem[] = completions.map(completion => {
          const habit = habits?.find(h => h.id === completion.habit_id);
          const profile = profiles?.find(p => p.user_id === completion.user_id);
          
          return {
            id: completion.id,
            completion_date: completion.completion_date,
            notes: completion.notes || '',
            habits: {
              name: habit?.name || 'Unknown',
              frequency: habit?.frequency || 'daily',
              categories: habit?.categories || undefined
            },
            profiles: {
              username: profile?.username || 'Unknown',
              full_name: profile?.full_name || 'Unknown'
            }
          };
        });

        setFriendsActivity(activity);
      } else {
        setFriendsActivity([]);
      }
    } catch (error: any) {
      console.error('Error fetching friends activity:', error);
    }
  };

  const followUser = async (userId: string) => {
    try {
      // Check if already following
      const { data: existing, error: checkError } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user?.id)
        .eq('following_id', userId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        toast({
          variant: "destructive",
          title: "Already following",
          description: "You are already following this user"
        });
        return;
      }

      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: user?.id,
          following_id: userId
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User followed successfully"
      });

      fetchFollowing();
      fetchFriendsActivity();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to follow user"
      });
    }
  };

  const unfollowUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user?.id)
        .eq('following_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User unfollowed"
      });

      fetchFollowing();
      fetchFriendsActivity();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to unfollow user"
      });
    }
  };

  const isFollowing = (userId: string) => {
    return following.some(f => f.user_id === userId);
  };

  const formatActivityDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Friends & Community</h1>
        <p className="text-muted-foreground">
          Connect with others and stay motivated together
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="feed">Activity Feed</TabsTrigger>
          <TabsTrigger value="search">Find Friends</TabsTrigger>
          <TabsTrigger value="connections">My Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Friends' Activity
              </CardTitle>
              <CardDescription>
                See what your friends have been up to
              </CardDescription>
            </CardHeader>
            <CardContent>
              {friendsActivity.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No activity yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Follow some friends to see their habit completions here
                  </p>
                  <Button onClick={() => setActiveTab('search')}>
                    Find Friends
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {friendsActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <Avatar>
                        <AvatarFallback>
                          {activity.profiles.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{activity.profiles.username}</span>
                          <span className="text-muted-foreground">completed</span>
                          <Badge 
                            variant="secondary"
                            style={{
                              backgroundColor: `${activity.habits.categories?.color || '#3B82F6'}20`,
                              color: activity.habits.categories?.color || '#3B82F6'
                            }}
                          >
                            {activity.habits.name}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatActivityDate(activity.completion_date)}</span>
                          {activity.habits.categories && (
                            <>
                              <span>•</span>
                              <span>{activity.habits.categories.name}</span>
                            </>
                          )}
                        </div>
                        {activity.notes && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            "{activity.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Search className="h-5 w-5 mr-2" />
                Find Friends
              </CardTitle>
              <CardDescription>
                Search for users by username
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                />
                <Button onClick={searchUsers} disabled={loading}>
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={profile.avatar_url} />
                          <AvatarFallback>
                            {profile.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{profile.username}</p>
                          {profile.full_name && (
                            <p className="text-sm text-muted-foreground">{profile.full_name}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => isFollowing(profile.user_id) 
                          ? unfollowUser(profile.user_id)
                          : followUser(profile.user_id)
                        }
                        variant={isFollowing(profile.user_id) ? "secondary" : "default"}
                      >
                        {isFollowing(profile.user_id) ? (
                          'Unfollow'
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-1" />
                            Follow
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Following ({following.length})</CardTitle>
                <CardDescription>
                  Users you're following
                </CardDescription>
              </CardHeader>
              <CardContent>
                {following.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">Not following anyone yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {following.map((profile) => (
                      <div key={profile.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile.avatar_url} />
                            <AvatarFallback>
                              {profile.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{profile.username}</p>
                            {profile.full_name && (
                              <p className="text-xs text-muted-foreground">{profile.full_name}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => unfollowUser(profile.user_id)}
                        >
                          Unfollow
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Followers ({followers.length})</CardTitle>
                <CardDescription>
                  Users following you
                </CardDescription>
              </CardHeader>
              <CardContent>
                {followers.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">No followers yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followers.map((profile) => (
                      <div key={profile.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile.avatar_url} />
                            <AvatarFallback>
                              {profile.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{profile.username}</p>
                            {profile.full_name && (
                              <p className="text-xs text-muted-foreground">{profile.full_name}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isFollowing(profile.user_id) ? "secondary" : "outline"}
                          onClick={() => isFollowing(profile.user_id) 
                            ? unfollowUser(profile.user_id)
                            : followUser(profile.user_id)
                          }
                        >
                          {isFollowing(profile.user_id) ? 'Following' : 'Follow Back'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Friends;