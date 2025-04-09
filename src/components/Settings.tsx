
import React, { useState } from 'react';
import { useReward } from '@/contexts/RewardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, MessageSquare, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const { contactInfo, setContactInfo } = useReward();
  const { toast } = useToast();
  const [email, setEmail] = useState(contactInfo.email);
  const [whatsapp, setWhatsapp] = useState(contactInfo.whatsapp);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    setContactInfo({
      email,
      whatsapp
    });
    
    toast({
      title: "Settings Saved",
      description: "Your contact information has been updated",
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
