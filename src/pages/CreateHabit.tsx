import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const habitSchema = z.object({
  name: z.string().min(1, 'Habit name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  frequency: z.enum(['daily', 'weekly'], {
    required_error: "Please select a frequency"
  }),
  category_id: z.string().min(1, 'Please select a category')
});

type HabitFormData = z.infer<typeof habitSchema>;

interface Category {
  id: string;
  name: string;
  color: string;
}

const CreateHabit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(isEditing);

  const form = useForm<HabitFormData>({
    resolver: zodResolver(habitSchema),
    defaultValues: {
      name: '',
      description: '',
      frequency: 'daily',
      category_id: ''
    }
  });

  useEffect(() => {
    fetchCategories();
    if (isEditing && id) {
      fetchHabit(id);
    }
  }, [isEditing, id]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch categories"
      });
    }
  };

  const fetchHabit = async (habitId: string) => {
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('id', habitId)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      
      if (data) {
        form.reset({
          name: data.name,
          description: data.description || '',
          frequency: data.frequency as 'daily' | 'weekly',
          category_id: data.category_id || ''
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch habit details"
      });
      navigate('/');
    } finally {
      setFetchingData(false);
    }
  };

  const onSubmit = async (data: HabitFormData) => {
    setLoading(true);
    try {
      if (isEditing && id) {
        // Update existing habit
        const { error } = await supabase
          .from('habits')
          .update({
            name: data.name,
            description: data.description || null,
            frequency: data.frequency,
            category_id: data.category_id
          })
          .eq('id', id)
          .eq('user_id', user?.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Habit updated successfully"
        });
      } else {
        // Check for duplicate habit names
        const { data: existingHabit, error: checkError } = await supabase
          .from('habits')
          .select('id')
          .eq('user_id', user?.id)
          .eq('name', data.name)
          .eq('is_active', true)
          .maybeSingle();

        if (checkError) throw checkError;
        
        if (existingHabit) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "You already have a habit with this name"
          });
          return;
        }

        // Create new habit
        const { error } = await supabase
          .from('habits')
          .insert({
            name: data.name,
            description: data.description || null,
            frequency: data.frequency,
            category_id: data.category_id,
            user_id: user?.id
          });

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Habit created successfully"
        });
      }
      
      navigate('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save habit"
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold">
          {isEditing ? 'Edit Habit' : 'Create New Habit'}
        </h1>
        <p className="text-muted-foreground">
          {isEditing ? 'Update your habit details' : 'Start building a new healthy habit'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Habit' : 'Habit Details'}</CardTitle>
          <CardDescription>
            Fill in the information about your habit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Habit Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. Drink 8 glasses of water" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Choose a clear, specific name for your habit
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any additional details about this habit..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Frequency</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="daily" id="daily" />
                          <label htmlFor="daily" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Daily - Complete every day
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="weekly" id="weekly" />
                          <label htmlFor="weekly" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Weekly - Complete once per week
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: category.color }}
                              />
                              <span>{category.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Categorize your habit to better organize your goals
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  ) : null}
                  {isEditing ? 'Update Habit' : 'Create Habit'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateHabit;