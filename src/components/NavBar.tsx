
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { User, LogOut, Award, UserCircle, Bell } from 'lucide-react';

const NavBar = () => {
  const { user, signOut } = useAuth();

  return (
    <nav className="bg-background border-b py-3">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold flex items-center gap-2 text-kid-purple">
          <Award className="h-5 w-5" />
          Family Hub
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/profile">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  Profile
                </Button>
              </Link>
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
