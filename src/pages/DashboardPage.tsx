import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { appSections } from '@/config/appSections';
import { cn } from '@/lib/utils';

const DashboardPage = () => (
  <div className="container mx-auto max-w-6xl px-4 pb-10 pt-3 sm:px-6 sm:pt-6">
    <header className="mb-6 sm:mb-8">
      <p className="mb-1 text-sm font-medium text-muted-foreground">Your family, all in one place</p>
      <h2 className="text-3xl font-bold text-foreground sm:text-4xl">What do you need?</h2>
    </header>

    <nav aria-label="Family Hub sections" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {appSections.map((section) => {
        const Icon = section.icon;
        return (
          <Link
            key={section.path}
            to={section.path}
            className="group min-w-0 rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-5"
          >
            <span className={cn('mb-5 flex h-12 w-12 items-center justify-center rounded-lg', section.surfaceClass)}>
              <Icon className={cn('h-6 w-6', section.iconClass)} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 text-base font-bold leading-tight sm:text-lg">{section.shortName}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
            <span className="mt-1 hidden text-sm leading-snug text-muted-foreground sm:block">
              {section.description}
            </span>
          </Link>
        );
      })}
    </nav>
  </div>
);

export default DashboardPage;
