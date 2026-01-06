"use client";
import React from 'react';
import { CustomNavbar } from './CustomNavbar';
import { HeroSection } from './HeroSection';
import { DemoVideoSection } from './DemoVideoSection';
import { FeaturesSection } from './FeaturesSection';
import { HowToUseSection } from './HowToUseSection';
import { Testimonials } from './Testimonials';
import { FAQSection } from './FAQSection';
import { CtaSection } from './CtaSection';
import { Footer } from './Footer';
import { HorizontalLine } from './HorizontalLine';
import { Contributors } from './Contributors';
import { useTranslations } from 'next-intl';

interface LandingPageProps {
  className?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({ className = '' }) => {
  const t = useTranslations();

  return (
    <div className={`min-h-screen max-w-7xl mx-auto bg-background text-foreground relative pt-5 ${className}`}>
      {/* Left Vertical Line - positioned to match navbar content width */}
      <div className="fixed top-0 h-full w-px bg-gray-200 dark:bg-neutral-700 z-10"
           style={{ left: 'calc(50vw - 640px)' }}>
      </div>

      {/* Right Vertical Line - positioned to match navbar content width */}
      <div className="fixed top-0 h-full w-px bg-gray-200 dark:bg-neutral-700 z-10"
           style={{ right: 'calc(50vw - 640px)' }}>
      </div>

      {/* Navigation */}
      <CustomNavbar />
      <HorizontalLine />

      {/* Hero Section */}
      <HeroSection
        title={t('landing.hero.title')}
        highlightText={t('landing.hero.highlightText')}
        description={t('landing.hero.description')}
        primaryButtonText={t('landing.hero.primaryButton')}
        secondaryButtonText={t('landing.hero.secondaryButton')}
      />

      <HorizontalLine />

      {/* Demo Video Section */}
      <DemoVideoSection
        videoSrc="doable"
        title={t('landing.demo.title')}
        description={t('landing.demo.description')}
      />

      <HorizontalLine />
      
      {/* How to Use Section */}
      <HowToUseSection />
      
      <HorizontalLine />

      {/* Features Section */}
      <FeaturesSection />
      
      <HorizontalLine />
      
      {/* Testimonials Section */}
      <Testimonials />
      
      <HorizontalLine />
      
      {/* FAQ Section */}
      <FAQSection />
      
      <HorizontalLine />
      
      {/* Contributors Section */}
      <Contributors />
      
      <HorizontalLine />
      
      {/* CTA Section */}
      <CtaSection />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};
