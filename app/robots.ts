import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://thegroupfinder.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/en/", "/zh/"],
        disallow: [
          "/dashboard/",
          "/api/",
          "/invite/",
          "/*?*conversationId=*", // Don't index chat conversations with query params
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

