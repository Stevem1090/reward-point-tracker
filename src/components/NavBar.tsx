
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { User, LogOut } from 'lucide-react';

const NavBar = () => {
  const { user, signOut } = useAuth();

  return (
    <nav className="bg-background border-b py-3">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">
          Reward Point Tracker
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="text-sm mr-2">
                {user.email}
              </div>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button variant="outline" size="sm">
                <User className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
