import Blog from "lib/models/blog/Blog";
import { logError } from "lib/services/errorService";
import path from "path";
import fs from "fs";
import { format, subDays } from "date-fns";
import Page from "lib/models/basic/Page";
import mongoose, { isValidObjectId, Types } from "mongoose";
import { AnyModel } from "lib/models";
import UrlRegistry from "lib/models/basic/UrlRegistry";
import Faq from "lib/models/basic/Faq";
import Testimonial from "lib/models/basic/Testimonial";
import Meta from "lib/models/basic/Meta";
import Product from "lib/models/product/Product";

const SITE_URL = "https://www.mishtir.com";

type MetaInput = {
  meta_id: mongoose.Types.ObjectId | string | null;
  url: string;
  title: string;
  description: string;
  media_id?: mongoose.Types.ObjectId | string | null;
};

export const slugify = async (
  url: string, 
  model: AnyModel, 
  model_id?: string | Types.ObjectId | null
): Promise<string> => {
  const id = model_id instanceof Types.ObjectId ? model_id.toString() : model_id;

  let slug = url
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()
  .replace(/\s+/gu, '-')
  .replace(/[^\p{L}\p{N}-]+/gu, '')
  .replace(/-+/g, "-")
  .replace(/^-+|-+$/g, "");      

  if (url === "/" || !slug) { return "/"; }

  const existingDoc = await model.findOne({ url: slug });

  if (existingDoc && (!id || existingDoc._id.toString() !== id)) {
    let counter = 1;
    let newSlug = `${slug}-${counter}`;

    while (await model.findOne({ url: newSlug })) {
      counter++;
      newSlug = `${slug}-${counter}`;
    }

    slug = newSlug;
  }

  return slug;
};

export const generateSitemap = async () => {
  try {
    await syncUrlRegistry();

    const site = "https://www.mishtir.com";

    const urlRegistry = await UrlRegistry.find({
      url: { $ne: "/" },
      $or: [
        { "seo.robots": { $exists: false } },
        { "seo.robots": { $regex: /index/i } },
      ],
    }).select("url module module_id seo updatedAt");

    const today = format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX");

    const uniqueUrls = new Map<string, { url: string; updatedAt?: Date; priority: number }>();

    uniqueUrls.set(site, { url: "/", priority: 1.0 });

    urlRegistry.forEach((item) => {
      if (!item.url) return;

      const url = item.url.startsWith("/") ? item.url : `/${item.url}`;

      if (uniqueUrls.has(url)) return;

      const priority = item.module === "Blog" ? 0.8 : item.module === "Page" ? 0.9 : 0.85;

      uniqueUrls.set(url, {
        url,
        updatedAt: item.updatedAt,
        priority,
      });
    });

    const urlEntry = (item: { url: string; updatedAt?: Date; priority: number }) => `
      <url>
        <loc>${site}${item.url === "/" ? "" : item.url}</loc>
        <lastmod>${item.updatedAt ? format(item.updatedAt, "yyyy-MM-dd'T'HH:mm:ssXXX") : today}</lastmod>
        <priority>${item.priority.toFixed(2)}</priority>
      </url>
    `;

    const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${Array.from(uniqueUrls.values()).map(urlEntry).join("")}
      </urlset>`;

    const sitemapPath = path.join(process.cwd(), "public", "sitemap.xml");

    fs.writeFileSync(sitemapPath, sitemapXML);

    const imageSitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.google.com/schemas/sitemap-image/1.1">
      </urlset>`;

    fs.writeFileSync(path.join(process.cwd(), "public", "sitemap-image.xml"), imageSitemapXML);

    const newsSitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.google.com/schemas/sitemap-news/0.9">
      </urlset>`;

    fs.writeFileSync(path.join(process.cwd(), "public", "news-sitemap.xml"), newsSitemapXML);

    const urls = Array.from(uniqueUrls.values()).map((item) => `${site}${item.url === "/" ? "" : item.url}`);

    urls.push(`${site}/sitemap.xml`);
    urls.push(`${site}/sitemap-image.xml`);
  } catch (error) {
    await logError(error, { function: "generateSitemap", payload: {} });
  }
};

  export interface ModelSyncConfig {
    module: string;
    model: any;
    urlField?: string;
    isDynamicModule?: boolean;
  }

  const generateSchemaPayload = (
    doc: any, 
    moduleName: string, 
    urlValue: string, 
    mediaPath: string | null, 
    siteUrl: string, 
    faqs: any[], 
    testimonials: any[],
    langCode: string = "en"
  ) => {
    const docTitle = doc.title || doc.name || moduleName;
    const docDesc = doc.description || doc.summary || `${docTitle} - Detailed information and offerings.`;
    const canonicalUrl = `${siteUrl}/${urlValue}`;
    const siteName = "Amitkk";
    const logoUrl = `${siteUrl}/images/logo.svg`;

    // Ensure image is an absolute URL
    const absoluteImagePath = mediaPath 
      ? (mediaPath.startsWith('http') ? mediaPath : `${siteUrl}${mediaPath.startsWith('/') ? '' : '/'}${mediaPath}`)
      : null;

    const organizationNode = {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      "name": siteName,
      "url": siteUrl,
      "logo": {
        "@type": "ImageObject",
        "@id": `${siteUrl}/#logo`,
        "url": logoUrl
      },
      "sameAs": [
        "https://www.facebook.com/Amitkk-110578507216727",
        "https://www.instagram.com/_amitkk_/",
        "https://www.linkedin.com/in/amitkhare588/"
      ]
    };

    const breadcrumbNode = {
      "@type": "BreadcrumbList",
      "@id": `${canonicalUrl}#breadcrumb`,
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": siteUrl
        },
        ...(urlValue && urlValue !== "" ? [
          {
            "@type": "ListItem",
            "position": 2,
            "name": moduleName,
            "item": `${siteUrl}/${moduleName.toLowerCase()}`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": docTitle,
            "item": canonicalUrl
          }
        ] : [])
      ]
    };

    let mainEntityNodeType = "WebPage";
    const normalizedModule = moduleName.toLowerCase();
    const normalizedTitle = docTitle.toLowerCase();

    if (normalizedModule === "blog") mainEntityNodeType = "BlogPosting";
    else if (normalizedModule === "about" || normalizedTitle.includes("about")) mainEntityNodeType = "AboutPage";
    else if (normalizedModule === "contact" || normalizedTitle.includes("contact")) mainEntityNodeType = "ContactPage";

    let mainEntityNode: any;

    if (normalizedModule === "blog") {
      mainEntityNode = {
        "@type": "BlogPosting",
        "@id": `${canonicalUrl}#webpage`,
        "url": canonicalUrl,
        "inLanguage": langCode,
        "headline": docTitle,
        "name": docTitle,
        "description": docDesc,
        ...(absoluteImagePath && { "image": { "@type": "ImageObject", "url": absoluteImagePath } }),
        "datePublished": doc.createdAt || new Date().toISOString(),
        "dateModified": doc.updatedAt || new Date().toISOString(),
        "author": {
          "@type": "Person",
          "name": doc.author || siteName
        },
        "publisher": {
          "@id": `${siteUrl}/#organization`
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": canonicalUrl
        }
      };
    } else if (normalizedModule === "service") {
      mainEntityNode = {
        "@type": "Service",
        "@id": `${canonicalUrl}#service`,
        "name": docTitle,
        "description": docDesc,
        "inLanguage": langCode,
        "provider": {
          "@id": `${siteUrl}/#organization`
        },
        "areaServed": {
          "@type": "AdministrativeArea",
          "name": "Middle East"
        },
        ...(absoluteImagePath && { "image": absoluteImagePath })
      };
    } else {
      mainEntityNode = {
        "@type": mainEntityNodeType,
        "@id": `${canonicalUrl}#webpage`,
        "url": canonicalUrl,
        "name": docTitle,
        "description": docDesc,
        "inLanguage": langCode,
        "publisher": {
          "@id": `${siteUrl}/#organization`
        },
        ...(absoluteImagePath && { "image": absoluteImagePath })
      };
    }

    const graphEntities: any[] = [organizationNode, breadcrumbNode, mainEntityNode];

    if (faqs && faqs.length > 0) {
      graphEntities.push({
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        "inLanguage": langCode,
        "mainEntity": faqs.map((faq: any) => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      });
    }

    if (testimonials && testimonials.length > 0) {
      const reviewNodes = testimonials.map((t: any, index: number) => {
        const clientName = t.client_id?.name || "Verified Customer";
        const ratingValue = t.rating || 5;

        return {
          "@type": "Review",
          "@id": `${canonicalUrl}#review-${index}`,
          "itemReviewed": {
            "@id": `${siteUrl}/#organization`
          },
          "author": {
            "@type": "Person",
            "name": clientName
          },
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": ratingValue,
            "bestRating": "5"
          },
          "reviewBody": t.content
        };
      });

      graphEntities.push(...reviewNodes);
    }

    return {
      "@context": "https://schema.org",
      "@graph": graphEntities
    };
  };

  export async function getResolvedSeoPayload(metaId: string | Types.ObjectId | null, defaultDoc: any, moduleName: string, urlValue: string, siteUrl: string) {
    let docTitle = defaultDoc.title || defaultDoc.name || moduleName;
    let docDesc = defaultDoc.description || defaultDoc.summary || `${docTitle} - Detailed information and offerings.`;
    let noIndex = defaultDoc.noIndex || false;

    if (metaId) {
      const baseMeta = await mongoose.model("Meta").findById(metaId).lean() as any;
      if (baseMeta) {
        docTitle = baseMeta.title || docTitle;
        docDesc = baseMeta.description || docDesc;
        noIndex = baseMeta.noIndex || noIndex;
      }
    }

    const canonicalUrl = `${siteUrl}/${urlValue}`;
    const mediaObj = defaultDoc.media_id;
    const mediaPath = mediaObj?.path || mediaObj?.url || null;

    return {
      meta_id: metaId ? String(metaId) : null,
      title: docTitle,
      description: docDesc,
      robots: noIndex ? "noindex,nofollow" : "index,follow",
      canonical: canonicalUrl,
      ogType: "website",
      ogTitle: docTitle,
      ogDescription: docDesc,
      ogImage: mediaPath,
      twitterCard: "summary_large_image",
      twitterTitle: docTitle,
      twitterDescription: docDesc,
      twitterImage: mediaPath,
      noIndex: noIndex,
      path: urlValue,
    };
  }

  export async function syncUrlRegistry(batchSize = 1000) {
    try {
      const MODELS_TO_SYNC: ModelSyncConfig[] = [
        { module: 'Blog', model: Blog },
        { module: 'Page', model: Page, isDynamicModule: true },
      ];

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mishtir.com";
      const processedUrls: string[] = [];
      const specializedModules = ['Blog'];

      for (const config of MODELS_TO_SYNC) {
        const { module: fallbackModuleName, model, urlField = 'url', isDynamicModule } = config;
        let bulkOps: any[] = [];

        const query = { [urlField]: { $exists: true, $ne: '' } };
        const cursor = model.find(query)
          .populate([
            { path: 'media_id', select: 'path url' },
            { path: 'meta_id', select: 'title description noIndex' }
          ])
          .lean()
          .cursor();

        for await (const doc of cursor as any) {
          const urlValue = doc[urlField];
          const rawModule = doc.module || fallbackModuleName;
          const moduleName = isDynamicModule ? rawModule : fallbackModuleName;

          // Skip dynamic modules handled by dedicated models
          if (isDynamicModule && specializedModules.includes(rawModule)) { 
            continue; 
          }

          const moduleIdObj = doc._id as Types.ObjectId;
          processedUrls.push(urlValue);

          const mediaObj = doc.media_id;
          const mediaPath = mediaObj?.path || mediaObj?.url || null;
          const moduleRegex = new RegExp(`^${moduleName}$`, "i");

          let faqs: any[] = [];
          let testimonials: any[] = [];
          try {
            [faqs, testimonials] = await Promise.all([
              Faq.find({ module: moduleRegex, module_id: doc._id, status: true }).lean(),
              Testimonial.find({ module: moduleRegex, module_id: doc._id, status: true }).populate({ path: 'client_id', select: 'name' }).lean()
            ]);
          } catch (subErr) {
            console.error(`[SYNC_ERROR] Sub-query failed for ${urlValue}:`, subErr);
          }

          let seoPayload = null;
          let schemaPayload = null;
          try {
            seoPayload = await getResolvedSeoPayload(doc.meta_id?._id || doc.meta_id, doc, moduleName, urlValue, siteUrl);
            schemaPayload = generateSchemaPayload(doc, moduleName, urlValue, mediaPath, siteUrl, faqs, testimonials, 'en');
          } catch (payloadErr) {
            console.error(`[SYNC_ERROR] Payload generation failed for ${urlValue}:`, payloadErr);
          }

          bulkOps.push({
            updateOne: {
              filter: { 
                url: urlValue, 
              },
              update: { 
                $set: { 
                  name: doc.name || doc.title || doc.page_name || "Untitled Resource",
                  url: urlValue, 
                  module: moduleName, 
                  module_id: moduleIdObj,
                  seo: seoPayload,
                  schema: schemaPayload
                } 
              },
              upsert: true,
            },
          });

          if (bulkOps.length >= batchSize) {
            try {
              await UrlRegistry.bulkWrite(bulkOps, { ordered: false });
            } catch (bulkErr) {
              console.warn(`[SYNC_WARN] Partial duplicate key errors in bulkWrite (ignored):`, bulkErr);
            }
            bulkOps = [];
          }
        }

        if (bulkOps.length > 0) {
          try {
            await UrlRegistry.bulkWrite(bulkOps, { ordered: false });
          } catch (bulkErr) {
            console.warn(`[SYNC_WARN] Partial duplicate key errors in bulkWrite for ${fallbackModuleName} (ignored):`, bulkErr);
          }
        }
      }

      if (processedUrls.length > 0) {
        await UrlRegistry.deleteMany({ url: { $nin: processedUrls } });
      }
    } catch (error) { 
      await logError(error, { function: 'syncUrlRegistry', payload: {} }); 
    }
  }

  export async function upsertMeta({ meta_id, url, title, description, media_id }: MetaInput): Promise<string | null> {
    try {
      if (!url || !title || !description) { throw new Error('URL, title, and description are required'); }
      
      let entry;
      if (meta_id && isValidObjectId(meta_id)) {
        entry = await Meta.findByIdAndUpdate(
          meta_id,
          { url, title, description, media_id },
          { new: true, runValidators: true }
        );
      } else {
        entry = await Meta.create({ url, title, description, media_id });
      }
  
      return entry._id.toString();
    } catch (error) { await logError(error, { function: "upsertMeta", payload: { meta_id, url, title, description, media_id } }); return null; }
  };

export async function getSitemapData() {
  const [ blogs, pages, products ] = await Promise.all([
    Blog.find({ status: true }).select("_id name url").lean().exec(),
    Page.find({ status: true }).select("_id name url").lean().exec(),
    Product.find({ status: true }).select("_id name url").lean().exec(),
  ]);

  return { blogs, pages, products };
}