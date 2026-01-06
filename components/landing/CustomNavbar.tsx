"use client";
import React from 'react';
import {
  Navbar,
  NavBody,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavbarLogo,
  NavbarButton,
  NavItems
} from '@/components/ui/resizable-navbar';
import { GitHubStarButton } from './GitHubStarButton';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';

interface CustomNavbarProps {
  className?: string;
}

export const CustomNavbar: React.FC<CustomNavbarProps> = ({ className }) => {
  const t = useTranslations();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <Navbar className={className}>
      {/* Desktop Navigation */}
      <NavBody>
        <NavbarLogo />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <NavbarButton href="/dashboard" variant="primary">
            {t('landing.navbar.getStarted')}
          </NavbarButton>
        </div>
      </NavBody>

      {/* Mobile Navigation */}
      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <MobileNavToggle
            isOpen={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
        </MobileNavHeader>
        <MobileNavMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <LanguageSwitcher />
            <NavbarButton href="/dashboard" variant="primary">
              {t('landing.navbar.getStarted')}
            </NavbarButton>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
};
