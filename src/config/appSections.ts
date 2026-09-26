import type { LucideIcon } from 'lucide-react';
import { Award, CheckSquare, ListChecks, Receipt, Scale, UserCircle, UtensilsCrossed } from 'lucide-react';

export type AppSection = {
  name: string;
  shortName: string;
  description: string;
  path: string;
  icon: LucideIcon;
  surfaceClass: string;
  iconClass: string;
};

export const appSections: AppSection[] = [
  { name: 'Tasks', shortName: 'Tasks', description: 'Keep on top of what needs doing', path: '/tasks', icon: CheckSquare, surfaceClass: 'bg-soft-blue', iconClass: 'text-kid-blue' },
  { name: 'Rewards', shortName: 'Rewards', description: 'Track points and celebrate progress', path: '/rewards', icon: Award, surfaceClass: 'bg-soft-yellow', iconClass: 'text-accent-foreground' },
  { name: 'Bills', shortName: 'Bills', description: 'See household money at a glance', path: '/bills', icon: Receipt, surfaceClass: 'bg-soft-pink', iconClass: 'text-kid-pink' },
  { name: 'Meals', shortName: 'Meals', description: 'Plan meals, recipes and shopping', path: '/meals', icon: UtensilsCrossed, surfaceClass: 'bg-soft-orange', iconClass: 'text-kid-orange' },
  { name: 'Chores', shortName: 'Chores', description: 'Share and manage family chores', path: '/chores', icon: ListChecks, surfaceClass: 'bg-soft-green', iconClass: 'text-kid-green' },
  { name: 'Slimming World', shortName: 'Slimming World', description: 'Log food and follow your progress', path: '/slimming-world', icon: Scale, surfaceClass: 'bg-soft-purple', iconClass: 'text-kid-purple' },
  { name: 'Profile & notifications', shortName: 'Profile', description: 'Manage your family and notifications', path: '/profile', icon: UserCircle, surfaceClass: 'bg-muted', iconClass: 'text-muted-foreground' },
];
