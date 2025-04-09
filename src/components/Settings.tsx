
import React, { useState } from 'react';
import { useReward } from '@/contexts/RewardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, MessageSquare, Save, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

const Settings = () => {
  const { contactInfo, setContactInfo, autoSendEnabled, setAutoSendEnabled, autoSendTime, setAutoSendTime } = useReward();
  const { toast } = useToast();
  const [email, setEmail] = useState(contactInfo.email);
  const [whatsapp, setWhatsapp] = useState(contactInfo.whatsapp);
  const [isAutoSend, setIsAutoSend] = useState(autoSendEnabled);
  const [timeValue, setTimeValue] = useState(autoSendTime);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    setContactInfo({
      email,
      whatsapp
    });
    
    setAutoSendEnabled(isAutoSend);
    setAutoSendTime(timeValue);
    
    toast({
      title: "Settings Saved",
      description: "Your contact information and preferences have been updated",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contact Settings</CardTitle>
          <CardDescription>Set up how you want to receive daily summaries</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Daily summaries can be sent to this email address.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                WhatsApp Number
              </Label>
              <Input
                id="whatsapp"
                placeholder="+1234567890"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Include country code (e.g., +1 for US). This will open WhatsApp with the summary text.
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label htmlFor="autoSend" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Auto-send daily summary via email
                </Label>
                <Switch
                  id="autoSend"
                  checked={isAutoSend}
                  onCheckedChange={setIsAutoSend}
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="autoSendTime">Send time:</Label>
                <Input
                  id="autoSendTime"
                  type="time"
                  value={timeValue}
                  onChange={e => setTimeValue(e.target.value)}
                  disabled={!isAutoSend}
                  className="w-auto"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, a summary will be automatically sent to your email address at the specified time every day.
              </p>
            </div>
            
            <Button type="submit" className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>About This App</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This app helps track reward points for behavior and achievements. You can customize up to 8 categories, 
            add or deduct points throughout the day, and send a summary report via email or WhatsApp.
          </p>
          <p className="text-muted-foreground mt-4">
            All data is stored locally on your device. No data is sent to external servers except when you 
            explicitly share summaries via email or WhatsApp.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
