
import React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Star, LogIn } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const Login = () => {
  const { signIn, loading } = useAuth();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await signIn(values.email, values.password);
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen bg-gradient-to-b from-soft-blue via-white to-soft-purple">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-kid-purple via-kid-pink to-kid-blue bg-clip-text text-transparent mb-2">
            Reward Point Tracker
          </h1>
          <p className="text-muted-foreground">Track good behavior and earn rewards!</p>
        </div>
        
        <Card className="kid-card border-kid-purple/30 bg-white/90 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-2">
              <div className="rounded-full bg-soft-purple p-2">
                <Star className="h-8 w-8 text-kid-purple animate-pulse" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center text-kid-purple">Login</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter your email" 
                          {...field} 
                          className="rounded-xl border-kid-purple/20 focus-visible:ring-kid-purple/50" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter your password" 
                          {...field} 
                          className="rounded-xl border-kid-purple/20 focus-visible:ring-kid-purple/50" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full kid-button bg-gradient-to-r from-kid-purple to-kid-blue text-white border-0"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-kid-purple/10 pt-4">
            <p className="text-sm text-gray-500">
              Don't have an account?{" "}
              <Link to="/signup" className="text-kid-purple font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Login;
