import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, CalendarClock, Clock, Loader2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import { useToast } from '@/hooks/use-toast';
import { sendPushNotification } from '@/utils/vapidUtils';

type Reminder = {
  id: string;
  title: string;
  time: string;
  days: string[];
  active: boolean;
  owner_ids: string[];
};

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type FamilyMember = {
  id: string;
  name: string;
  color: string;
};

const RemindersPage = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newReminder, setNewReminder] = useState({
    title: "",
    time: "12:00",
    days: [] as string[]
  });
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [selectedFamilyMembers, setSelectedFamilyMembers] = useState<string[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isEnablingReminders, setIsEnablingReminders] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchFamilyMembers();
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const { data: reminderData, error: reminderError } = await supabase
        .from('reminders')
        .select('*')
        .order('created_at', { ascending: false });

      if (reminderError) throw reminderError;

      const { data: ownerData, error: ownerError } = await supabase
        .from('reminder_owners')
        .select('*');

      if (ownerError) throw ownerError;

      const remindersWithOwners = reminderData.map(reminder => ({
        ...reminder,
        owner_ids: ownerData
          .filter(owner => owner.reminder_id === reminder.id)
          .map(owner => owner.owner_id)
      }));

      setReminders(remindersWithOwners);
    } catch (error) {
      console.error('Error fetching reminders:', error);
      toast({
        title: "Error",
        description: "Failed to load reminders",
        variant: "destructive",
      });
    }
  };

  const fetchFamilyMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setFamilyMembers(data || []);
    } catch (error) {
      console.error('Error fetching family members:', error);
      toast({
        title: "Error",
        description: "Failed to load family members",
        variant: "destructive",
      });
    }
  };

  const handleDayToggle = (day: string) => {
    setNewReminder(prev => {
      const days = prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day];
      return { ...prev, days };
    });
  };

  const handleAddReminder = async () => {
    if (!newReminder.title.trim() || newReminder.days.length === 0) return;

    try {
      const { data: reminderData, error: reminderError } = await supabase
        .from('reminders')
        .insert([{
          title: newReminder.title,
          time: newReminder.time,
          days: newReminder.days,
          active: true
        }])
        .select()
        .single();

      if (reminderError) throw reminderError;

      if (selectedFamilyMembers.length > 0) {
        const ownerInserts = selectedFamilyMembers.map(memberId => ({
          reminder_id: reminderData.id,
          owner_id: memberId
        }));

        const { error: ownerError } = await supabase
          .from('reminder_owners')
          .insert(ownerInserts);

        if (ownerError) throw ownerError;
      }

      await fetchReminders();

      setNewReminder({ title: "", time: "12:00", days: [] });
      setSelectedFamilyMembers([]);
      setIsAddingReminder(false);

      toast({
        title: "Success",
        description: "Reminder created successfully",
      });
    } catch (error) {
      console.error('Error adding reminder:', error);
      toast({
        title: "Error",
        description: "Failed to create reminder",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ active: !currentActive })
        .eq('id', id);

      if (error) throw error;

      setReminders(reminders.map(r => 
        r.id === id ? { ...r, active: !currentActive } : r
      ));

      toast({
        title: "Success",
        description: `Reminder ${!currentActive ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error toggling reminder:', error);
      toast({
        title: "Error",
        description: "Failed to update reminder",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setReminders(reminders.filter(r => r.id !== id));
      
      toast({
        title: "Success",
        description: "Reminder deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast({
        title: "Error",
        description: "Failed to delete reminder",
        variant: "destructive",
      });
    }
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10));
    date.setMinutes(parseInt(minutes, 10));
    return format(date, 'h:mm a');
  };

  const handleSubscriptionChange = (memberId: string, isSubscribed: boolean) => {
    console.log(`Family member ${memberId} notification status: ${isSubscribed}`);
  };

  const handleEnableReminders = async () => {
    try {
      setIsEnablingReminders(true);
      
      let targetMembers = selectedFamilyMembers;
      if (targetMembers.length === 0 && familyMembers.length > 0) {
        targetMembers = familyMembers.map(member => member.id);
        setSelectedFamilyMembers(targetMembers);
      }

      if (targetMembers.length === 0) {
        toast({
          title: "No family members available",
          description: "Please add family members first to enable notifications",
          variant: "destructive",
        });
        return;
      }

      await sendPushNotification(
        targetMembers,
        "Reminders Enabled",
        "You'll now receive notifications for your reminders!"
      );

      toast({
        title: "Reminders Enabled",
        description: "You'll receive notifications for your reminders",
      });
    } catch (error) {
      console.error('Error enabling reminders:', error);
      toast({
        title: "Error",
        description: "There was a problem enabling reminder notifications",
        variant: "destructive",
      });
    } finally {
      setIsEnablingReminders(false);
    }
  };

  const today = weekdays[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todaysReminders = reminders.filter(r => r.active && r.days.includes(today));

  return (
    <div className="container mx-auto max-w-5xl">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 bg-gradient-to-r from-kid-pink via-kid-purple to-kid-blue bg-clip-text text-transparent">
        Family Reminders
      </h1>
      <div className="flex justify-center mb-6 gap-2">
        <PushNotificationToggle 
          familyMemberIds={selectedFamilyMembers} 
          onSubscriptionChange={handleSubscriptionChange}
        />
        <Button 
          variant="default" 
          className="bg-kid-purple hover:bg-kid-purple/90 gap-2"
          onClick={handleEnableReminders}
          disabled={isEnablingReminders || selectedFamilyMembers.length === 0}
        >
          {isEnablingReminders ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Bell className="h-4 w-4" />
              Test Reminders
            </>
          )}
        </Button>
      </div>
      
      <p className="text-center mb-8 text-muted-foreground">Never forget important tasks!</p>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-7">
          <Card className="kid-card bg-white/80 backdrop-blur-sm shadow-md">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center text-kid-purple">
                  <Bell className="mr-2 h-5 w-5" />
                  All Reminders
                </CardTitle>
                <Button 
                  onClick={() => setIsAddingReminder(!isAddingReminder)}
                  variant="outline"
                  className="text-kid-purple hover:text-white hover:bg-kid-purple"
                >
                  {isAddingReminder ? "Cancel" : <><Plus className="h-4 w-4 mr-1" /> New Reminder</>}
                </Button>
              </div>
              <CardDescription>Manage your recurring reminders</CardDescription>
            </CardHeader>
            <CardContent>
              {isAddingReminder && (
                <div className="p-4 mb-4 border rounded-lg bg-soft-purple/30">
                  <h3 className="font-medium mb-3">New Reminder</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Title</label>
                      <Input 
                        value={newReminder.title}
                        onChange={(e) => setNewReminder({...newReminder, title: e.target.value})}
                        placeholder="Reminder name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Time</label>
                      <Input 
                        type="time"
                        value={newReminder.time}
                        onChange={(e) => setNewReminder({...newReminder, time: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Days</label>
                      <div className="flex flex-wrap gap-1">
                        {weekdays.map(day => (
                          <Badge 
                            key={day}
                            variant={newReminder.days.includes(day) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => handleDayToggle(day)}
                          >
                            {day.substring(0, 3)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Assign to Family Members</label>
                      <div className="flex flex-wrap gap-1">
                        {familyMembers.map(member => (
                          <Badge 
                            key={member.id}
                            variant={selectedFamilyMembers.includes(member.id) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              setSelectedFamilyMembers(prev => 
                                prev.includes(member.id) 
                                  ? prev.filter(id => id !== member.id)
                                  : [...prev, member.id]
                              );
                            }}
                            style={{
                              backgroundColor: selectedFamilyMembers.includes(member.id) ? member.color : 'transparent',
                              color: selectedFamilyMembers.includes(member.id) ? 'white' : 'inherit',
                              borderColor: member.color
                            }}
                          >
                            {member.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button 
                      onClick={handleAddReminder}
                      className="w-full bg-kid-purple hover:bg-kid-purple/80"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Reminder
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                {reminders.map(reminder => (
                  <div 
                    key={reminder.id}
                    className={`p-3 rounded-lg bg-white shadow-sm border hover:shadow-md transition-all ${
                      !reminder.active ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-kid-purple" />
                          <h3 className="font-medium">{reminder.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatTime(reminder.time)} • {reminder.days.map(d => d.substring(0, 3)).join(', ')}
                        </p>
                        {reminder.owner_ids && reminder.owner_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {reminder.owner_ids.map(ownerId => {
                              const member = familyMembers.find(m => m.id === ownerId);
                              return member ? (
                                <Badge
                                  key={ownerId}
                                  variant="secondary"
                                  style={{
                                    backgroundColor: `${member.color}20`,
                                    color: member.color,
                                    borderColor: `${member.color}40`
                                  }}
                                >
                                  {member.name}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(reminder.id, reminder.active)}
                          className={reminder.active 
                            ? "border-kid-purple text-kid-purple hover:bg-kid-purple hover:text-white" 
                            : "border-muted-foreground text-muted-foreground"
                          }
                        >
                          {reminder.active ? "Active" : "Inactive"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteReminder(reminder.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {reminders.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No reminders set up yet.</p>
                    <p className="mt-2 text-sm">Create your first reminder to get started!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-5">
          <Card className="kid-card bg-white/80 backdrop-blur-sm shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-kid-purple">
                <CalendarClock className="mr-2 h-5 w-5" />
                Today's Reminders
              </CardTitle>
              <CardDescription>
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {todaysReminders.map(reminder => (
                  <div 
                    key={reminder.id}
                    className="p-3 rounded-lg bg-white shadow-sm border hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{reminder.title}</h3>
                        <p className="text-sm text-kid-purple mt-1 font-medium">
                          {formatTime(reminder.time)}
                        </p>
                      </div>
                      <Bell className="h-5 w-5 text-kid-purple" />
                    </div>
                  </div>
                ))}
                
                {todaysReminders.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No reminders for today.</p>
                    <p className="mt-2 text-sm">Enjoy your day!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RemindersPage;
