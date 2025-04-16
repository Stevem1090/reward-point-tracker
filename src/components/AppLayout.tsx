
import React, { useState } from 'react';
import { Menu, X, Calendar, ListTodo, Award, Bell } from 'lucide-react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type MenuLink = {
  name: string;
  path: string;
  icon: React.ReactNode;
};

const menuLinks: MenuLink[] = [
  { name: 'Rewards', path: '/rewards', icon: <Award className="h-5 w-5" /> },
  { name: 'Calendar', path: '/calendar', icon: <Calendar className="h-5 w-5" /> },
  { name: 'Lists', path: '/lists', icon: <ListTodo className="h-5 w-5" /> },
  { name: 'Reminders', path: '/reminders', icon: <Bell className="h-5 w-5" /> },
];

const AppLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return <Outlet />;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center border-b">
        <div className="flex items-center gap-3">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[80%] sm:w-[300px] bg-soft-purple">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl font-bold text-kid-purple">
                  Family Hub
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2">
                {menuLinks.map((link) => (
                  <Link 
                    key={link.path} 
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:bg-white/50",
                      location.pathname === link.path && "bg-white text-kid-purple font-medium"
                    )}
                  >
                    {link.icon}
                    <span>{link.name}</span>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <h1 className="text-xl font-bold text-kid-purple">Family Hub</h1>
        </div>
      </div>

      <div className="flex flex-1 overflow-x-hidden">
        {/* Sidebar for larger screens */}
        <aside className="hidden md:block w-64 bg-soft-purple p-4 min-h-[calc(100vh-64px)]">
          <nav className="flex flex-col gap-2 mt-6">
            {menuLinks.map((link) => (
              <Link 
                key={link.path} 
                to={link.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:bg-white/50",
                  location.pathname === link.path && "bg-white text-kid-purple font-medium"
                )}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            ))}
          </nav>
        </aside>
        
        {/* Main content */}
        <main className="flex-1 pt-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
