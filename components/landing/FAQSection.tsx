"use client";

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useTranslations } from 'next-intl';

interface FAQSectionProps {
  className?: string;
}

export const FAQSection: React.FC<FAQSectionProps> = ({ className = '' }) => {
  const t = useTranslations();

  const faqData = [
    {
      question: t('landing.faq.questions.whoIsItFor.question'),
      answer: t('landing.faq.questions.whoIsItFor.answer')
    },
    {
      question: t('landing.faq.questions.whatIsIt.question'),
      answer: t('landing.faq.questions.whatIsIt.answer')
    },
    {
      question: t('landing.faq.questions.howAIWorks.question'),
      answer: t('landing.faq.questions.howAIWorks.answer')
    },
    {
      question: t('landing.faq.questions.isFree.question'),
      answer: t('landing.faq.questions.isFree.answer')
    },
    {
      question: t('landing.faq.questions.needTeam.question'),
      answer: t('landing.faq.questions.needTeam.answer')
    },
    {
      question: t('landing.faq.questions.howToStart.question'),
      answer: t('landing.faq.questions.howToStart.answer')
    },
    {
      question: t('landing.faq.questions.dataSafety.question'),
      answer: t('landing.faq.questions.dataSafety.answer')
    }
  ];
  return (
    <div className={`w-full py-12 md:py-20 relative ${className}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mb-3 md:mb-4">
            {t('landing.faq.title')}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            {t('landing.faq.subtitle')}
          </p>
        </div>

        {/* Accordion */}
        <Accordion type="single" collapsible className="w-full">
          {faqData.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`} className="border-b border-border/50">
              <AccordionTrigger className="text-left text-base sm:text-lg font-medium py-4 hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm sm:text-base text-muted-foreground leading-relaxed pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

