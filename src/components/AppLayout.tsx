
import { useState } from 'react';
import { Menu, LayoutGrid, LogOut } from 'lucide-react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { appSections } from '@/config/appSections';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const menuLinks = [
  { name: 'Dashboard', path: '/', icon: LayoutGrid },
  ...appSections.map(({ name, path, icon }) => ({ name, path, icon })),
];

const AppLayout = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    navigate('/');
  };

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
                {menuLinks.map(({ name, path, icon: Icon }) => (
                  <Link 
                    key={path} 
                    to={path}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:bg-white/50",
                      location.pathname === path && "bg-white text-kid-purple font-medium"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{name}</span>
                  </Link>
                ))}
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  className="h-auto justify-start gap-3 px-4 py-3 hover:bg-white/50"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign out</span>
                </Button>
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
            {menuLinks.map(({ name, path, icon: Icon }) => (
              <Link 
                key={path} 
                to={path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:bg-white/50",
                  location.pathname === path && "bg-white text-kid-purple font-medium"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{name}</span>
              </Link>
            ))}
          </nav>
        </aside>
        
        {/* Main content */}
        <main className="flex-1 pt-4 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
