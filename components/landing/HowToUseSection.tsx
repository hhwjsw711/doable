"use client";

import React from 'react';
import { useTranslations } from 'next-intl';

interface HowToUseSectionProps {
  className?: string;
}

export const HowToUseSection: React.FC<HowToUseSectionProps> = ({ className = '' }) => {
  const t = useTranslations();

  const steps = [
    {
      number: t('landing.howToUse.steps.step1.number'),
      title: t('landing.howToUse.steps.step1.title'),
      description: t('landing.howToUse.steps.step1.description')
    },
    {
      number: t('landing.howToUse.steps.step2.number'),
      title: t('landing.howToUse.steps.step2.title'),
      description: t('landing.howToUse.steps.step2.description')
    },
    {
      number: t('landing.howToUse.steps.step3.number'),
      title: t('landing.howToUse.steps.step3.title'),
      description: t('landing.howToUse.steps.step3.description')
    }
  ];

  return (
    <div id="how-it-works" className={`py-16 md:py-24 lg:py-32 bg-muted/30 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            {t('landing.howToUse.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('landing.howToUse.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-3xl mx-auto">
          <div className="space-y-10">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className="flex items-start gap-6 group justify-center"
              >
                {/* Step Number */}
                <div className="flex-shrink-0 justify-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-primary text-primary-foreground rounded-full text-xl font-bold group-hover:bg-primary/90 transition-colors">
                    {step.number}
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-2 max-w-lg justify-center">
                  {/* Title */}
                  <h3 className="text-2xl font-semibold text-foreground mb-2 justify-center">
                    {step.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed text-base justify-center">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
