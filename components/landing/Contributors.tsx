"use client";
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Github } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Contributor {
  login: string;
  name: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
  bio?: string;
}

interface ContributorsProps {
  className?: string;
}

export const Contributors: React.FC<ContributorsProps> = ({ className = '' }) => {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContributors = async () => {
      try {
        const response = await fetch('/api/contributors');
        if (!response.ok) {
          throw new Error('Failed to fetch contributors');
        }
        const data = await response.json();
        setContributors(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load contributors');
        console.error('Error fetching contributors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContributors();
  }, []);

  if (loading) {
    return (
      <div className={cn("w-full py-12 md:py-20", className)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mb-3 md:mb-4">
              Contributors
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              The amazing people who make TheGroupFinder possible
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-muted/50 rounded-lg aspect-square"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || contributors.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-full py-12 md:py-20 relative", className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mb-3 md:mb-4">
            Contributors
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            The amazing people who make TheGroupFinder possible
          </p>
        </div>

        {/* Contributors Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {contributors.map((contributor) => (
            <a
              key={contributor.login}
              href={contributor.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col items-center p-4 md:p-6 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              {/* Avatar */}
              <div className="relative mb-3 md:mb-4">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Image
                  src={contributor.avatar_url}
                  alt={contributor.name || contributor.login}
                  width={80}
                  height={80}
                  className="relative rounded-full border-2 border-border/50 group-hover:border-primary/50 transition-colors duration-300"
                />
              </div>

              {/* Name */}
              <h3 className="font-medium text-sm md:text-base text-foreground mb-1 text-center line-clamp-1">
                {contributor.name || contributor.login}
              </h3>

              {/* Username */}
              <p className="text-xs md:text-sm text-muted-foreground mb-2 flex items-center gap-1">
                <Github className="w-3 h-3" />
                <span className="line-clamp-1">{contributor.login}</span>
              </p>

              {/* Contributions */}
              <div className="mt-auto pt-2 text-xs text-muted-foreground">
                <span className="font-medium text-primary">{contributor.contributions}</span>
                <span className="ml-1">
                  {contributor.contributions === 1 ? 'contribution' : 'contributions'}
                </span>
              </div>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

