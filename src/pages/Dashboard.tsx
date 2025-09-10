import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Calendar, Target, TrendingUp, CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { format, isToday, startOfWeek, endOfWeek } from 'date-fns';

interface Habit {
  id: string;
  name: string;
  description: string;
  frequency: 'daily' | 'weekly';
  category_id: string;
  created_at: string;
  categories?: {
    name: string;
    color: string;
  };
  habit_completions: Array<{
    id: string;
    completion_date: string;
    notes: string;
  }>;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingHabit, setCompletingHabit] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchHabits();
    }
  }, [user]);

  const fetchHabits = async () => {
    try {
      const { data, error } = await supabase
        .from('habits')
        .select(`
          *,
          categories (name, color),
          habit_completions (id, completion_date, notes)
        `)
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHabits((data as Habit[]) || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch habits"
      });
    } finally {
      setLoading(false);
    }
  };

  const completeHabit = async (habitId: string, frequency: 'daily' | 'weekly') => {
    setCompletingHabit(habitId);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if already completed today/this week
      const habit = habits.find(h => h.id === habitId);
      const isCompleted = frequency === 'daily' 
        ? habit?.habit_completions.some(c => c.completion_date === today)
        : habit?.habit_completions.some(c => {
            const completionDate = new Date(c.completion_date);
            const weekStart = startOfWeek(new Date());
            const weekEnd = endOfWeek(new Date());
            return completionDate >= weekStart && completionDate <= weekEnd;
          });

      if (isCompleted) {
        toast({
          variant: "destructive",
          title: "Already completed",
          description: `You've already completed this habit ${frequency === 'daily' ? 'today' : 'this week'}`
        });
        return;
      }

      const { error } = await supabase
        .from('habit_completions')
        .insert({
          habit_id: habitId,
          user_id: user?.id,
          completion_date: today
        });

      if (error) throw error;

      toast({
        title: "Great job!",
        description: "Habit completed successfully"
      });

      fetchHabits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete habit"
      });
    } finally {
      setCompletingHabit(null);
    }
  };

  const getStreak = (habit: Habit) => {
    if (!habit.habit_completions.length) return 0;
    
    const completions = habit.habit_completions
      .map(c => new Date(c.completion_date))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const completion of completions) {
      completion.setHours(0, 0, 0, 0);
      
      if (habit.frequency === 'daily') {
        if (completion.getTime() === currentDate.getTime()) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else if (completion.getTime() === currentDate.getTime() + 86400000) {
          // If we missed today but completed yesterday, still count
          if (streak === 0) {
            currentDate.setDate(currentDate.getDate() - 1);
            if (completion.getTime() === currentDate.getTime()) {
              streak++;
              currentDate.setDate(currentDate.getDate() - 1);
            }
          }
        } else {
          break;
        }
      } else {
        // Weekly frequency logic would be more complex
        streak = completions.length;
        break;
      }
    }

    return streak;
  };

  const getCompletionRate = (habit: Habit) => {
    const daysSinceCreated = Math.ceil(
      (new Date().getTime() - new Date(habit.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const completions = habit.habit_completions.length;
    const expectedCompletions = habit.frequency === 'daily' 
      ? daysSinceCreated 
      : Math.ceil(daysSinceCreated / 7);
    
    return Math.min(100, Math.round((completions / Math.max(expectedCompletions, 1)) * 100));
  };

  const isHabitCompletedToday = (habit: Habit) => {
    const today = new Date().toISOString().split('T')[0];
    
    if (habit.frequency === 'daily') {
      return habit.habit_completions.some(c => c.completion_date === today);
    } else {
      return habit.habit_completions.some(c => {
        const completionDate = new Date(c.completion_date);
        const weekStart = startOfWeek(new Date());
        const weekEnd = endOfWeek(new Date());
        return completionDate >= weekStart && completionDate <= weekEnd;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Track your habits and build better routines</p>
        </div>
        <Button asChild>
          <Link to="/create-habit">
            <Plus className="h-4 w-4 mr-2" />
            Create Habit
          </Link>
        </Button>
      </div>

      {habits.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No habits yet</CardTitle>
            <CardDescription className="mb-4">
              Start building better habits by creating your first one
            </CardDescription>
            <Button asChild>
              <Link to="/create-habit">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Habit
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {habits.map((habit) => {
            const streak = getStreak(habit);
            const completionRate = getCompletionRate(habit);
            const isCompleted = isHabitCompletedToday(habit);
            
            return (
              <Card key={habit.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{habit.name}</CardTitle>
                    <Badge 
                      variant="secondary" 
                      style={{ 
                        backgroundColor: `${habit.categories?.color}20`,
                        color: habit.categories?.color 
                      }}
                    >
                      {habit.categories?.name}
                    </Badge>
                  </div>
                  {habit.description && (
                    <CardDescription>{habit.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Frequency</span>
                      <Badge variant="outline">{habit.frequency}</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Completion Rate</span>
                        <span className="font-medium">{completionRate}%</span>
                      </div>
                      <Progress value={completionRate} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Streak
                      </span>
                      <span className="font-medium">{streak} days</span>
                    </div>

                    <Button
                      onClick={() => completeHabit(habit.id, habit.frequency)}
                      disabled={isCompleted || completingHabit === habit.id}
                      className="w-full"
                      variant={isCompleted ? "secondary" : "default"}
                    >
                      {completingHabit === habit.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      ) : isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      ) : (
                        <Circle className="h-4 w-4 mr-2" />
                      )}
                      {isCompleted 
                        ? `Completed ${habit.frequency === 'daily' ? 'Today' : 'This Week'}`
                        : `Mark as Complete`
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;