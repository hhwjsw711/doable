import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://thegroupfinder.com";
  const locales = ['en', 'zh'] as const;

  // Define pages that should be included in sitemap
  const pages = [
    { path: '', priority: 1, changeFrequency: 'monthly' as const },
    { path: '/sign-up', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/sign-in', priority: 0.8, changeFrequency: 'monthly' as const },
  ];

  const sitemap: MetadataRoute.Sitemap = [];

  // Generate sitemap entries for each page in each locale
  pages.forEach((page) => {
    locales.forEach((locale) => {
      const url = `${baseUrl}/${locale}${page.path}`;

      sitemap.push({
        url,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        // Add alternates for language versions
        alternates: {
          languages: {
            en: `${baseUrl}/en${page.path}`,
            zh: `${baseUrl}/zh${page.path}`,
          },
        },
        // Add images and videos for homepage
        ...(page.path === '' && locale === 'en' ? {
          images: [`${baseUrl}/open-graph.png`],
          videos: [
            {
              title: "FizzProject Demo Video",
              thumbnail_loc: `${baseUrl}/open-graph.png`,
              description: "Watch how teams use FizzProject to manage tasks and collaborate effectively.",
            },
          ],
        } : {}),
      });
    });
  });

  return sitemap;
}

