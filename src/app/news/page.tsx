"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { generateAllData } from '@/lib/mock-data';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, X, Sparkles, AlertTriangle, TrendingUp, Shield, Target, ArrowRight, ExternalLink, Bookmark, Share2 } from 'lucide-react';
import { type NewsItem, type NewsTag } from '@/types';
import { cn } from '@/lib/utils';

// ─── Section definitions ────────────────────────────────────────────────────

interface FeedSection {
  id: string;
  title: string;
  sources: string[];
  filterFn: (item: { tags: NewsTag[]; competitor?: string }) => boolean;
}

const FEED_SECTIONS: FeedSection[] = [
  {
    id: "brand",
    title: "Brand & Corporate Narrative",
    sources: ["Retail Insider", "Financial Post", "Strategy Online", "The Globe and Mail"],
    filterFn: (item) => item.tags.includes("brand"),
  },
  {
    id: "publishing",
    title: "Book Industry & Publishing Shifts",
    sources: ["Publishers Weekly", "BookNet Canada", "Canadian Bookseller", "The Globe and Mail"],
    filterFn: (item) => item.tags.includes("publishing"),
  },
  {
    id: "genre",
    title: "Genre & Title Momentum",
    sources: ["BookNet Canada", "Publishers Weekly", "Amazon.ca Bestsellers", "Goodreads"],
    filterFn: (item) => item.tags.includes("genre"),
  },
  {
    id: "amazon",
    title: "Amazon Bestseller & Assortment Intelligence",
    sources: ["Amazon.ca Bestsellers", "Amazon.ca Category Data", "Amazon.ca New Releases", "Jungle Scout"],
    filterFn: (item) => item.tags.includes("amazon"),
  },
  {
    id: "social",
    title: "Social & Cultural Book Conversation",
    sources: ["Reddit r/books", "Reddit r/suggestmeabook", "Reddit r/CanLit", "Goodreads"],
    filterFn: (item) => item.tags.includes("social"),
  },
  {
    id: "gifting",
    title: "Gifting, Lifestyle & Home Trends",
    sources: ["Retail Insider", "Trend Hunter", "Pinterest Trends", "Shopify Canada"],
    filterFn: (item) => item.tags.includes("gifting"),
  },
  {
    id: "macro",
    title: "Macro Consumer & Retail Environment",
    sources: ["Statistics Canada", "The Globe and Mail", "Financial Post", "Deloitte Canada"],
    filterFn: (item) => item.tags.includes("macro"),
  },
];

// ─── Contextual image URL from article title ────────────────────────────────

const CURATED_IMAGES: Array<{ match: RegExp; photos: string[] }> = [
  // ── Brand & Corporate Narrative (pinned) — bookstore/retail imagery ──
  // 1. CEO Interview / brand mentions surge
  { match: /CEO Interview.*Cultural Retail/i, photos: ["photo-1568667256549-094345857637"] },
  // 2. Plum+ pricing / membership
  { match: /Plum\+ Pricing Narrative/i, photos: ["photo-1604866830893-c13cafa515d5"] },
  // 3. ESG Report / Nota sustainable
  { match: /ESG Report.*Nota/i, photos: ["photo-1559526324-4b87b5e36e44"] },
  // Brand loop
  // 22. Heather's Picks viral moment
  { match: /Heather.*Picks.*Viral/i, photos: ["photo-1507842217343-583bb7270b66"] },
  // 23. Small-format stores in Ontario
  { match: /Small-Format Stores/i, photos: ["photo-1580537659466-0a9bfa916a54"] },
  // 24. Exclusive limited edition sells out
  { match: /Exclusive Limited Edition/i, photos: ["photo-1476275466078-4007374efbbe"] },

  // ── Book Industry & Publishing Shifts (pinned) ──
  // 4. Publishing revenue $1.7B
  { match: /Publishing Revenue.*\$1\.7B/i, photos: ["photo-1524995997946-a1c2e315a42f"] },
  // 5. Audiobook sales grow 23%
  { match: /Audiobook Sales.*Grow/i, photos: ["photo-1478737270239-2f02b77fc618"] },
  // 6. Backlist resurgence
  { match: /Backlist Resurgence/i, photos: ["photo-1512820790803-83ca734da794"] },
  // Publishing loop
  // 25. Independent publishers 22% growth
  { match: /Independent Publishers.*22%/i, photos: ["photo-1521587760476-6c12a4b040da"] },
  // 26. eBook sales flatten
  { match: /eBook Sales Flatten/i, photos: ["photo-1544716278-ca5e3f4abd8c"] },
  // 27. Children's publishing fastest-growing
  { match: /Children.*Publishing.*Fastest/i, photos: ["photo-1503454537195-1dcabb73ffb9"] },

  // ── Genre & Title Momentum (pinned) ──
  // 7. Horror and dark fiction surge
  { match: /Horror and Dark Fiction/i, photos: ["photo-1519389950473-47ba0277781c"] },
  // 8. Romantasy continues / Fourth Wing
  { match: /Romantasy Continues.*Fourth Wing/i, photos: ["photo-1474932430478-367dbb6832c1"] },
  // 9. r/booktalk "The Returning Tide"
  { match: /Returning Tide|r\/booktalk/i, photos: ["photo-1495446815901-a7297e633e8d"] },
  // Genre loop
  // 28. Cozy mystery subgenre
  { match: /Cozy Mystery.*Comfort Reading/i, photos: ["photo-1481627834876-b7833e8f5570"] },
  // 29. Literary fiction resurgence
  { match: /Literary Fiction.*Resurgence/i, photos: ["photo-1457369804613-52c61a468e7d"] },
  // 30. Thriller genre fragments
  { match: /Thriller Genre Fragments/i, photos: ["photo-1587876931567-564ce588bfbd"] },

  // ── Amazon Bestseller & Assortment (pinned) ──
  // 10. Amazon bestsellers romance/romantasy top 20
  { match: /Amazon.*Bestsellers.*Romance.*Hold/i, photos: ["photo-1523474253046-8cd2748b5fd2"] },
  // 11. Amazon new releases climbing / slow living
  { match: /Amazon.*New Releases Climbing/i, photos: ["photo-1544947950-fa07a98d237f"] },
  // 12. Amazon BookTok list diverges
  { match: /Amazon.*BookTok.*Diverges/i, photos: ["photo-1472851294608-062f824d29cc"] },
  // Amazon loop
  // 31. Amazon gift bundle sales surge
  { match: /Amazon.*Gift Bundle.*Surge/i, photos: ["photo-1513885535751-8b9238bd345a"] },
  // 32. Amazon review velocity spikes / debut authors
  { match: /Amazon.*Review Velocity/i, photos: ["photo-1516979187457-637abb4f9353"] },
  // 33. Amazon children's category surge
  { match: /Amazon.*Children.*Surge/i, photos: ["photo-1471970471555-19d4b113e9ed"] },

  // ── Social & Cultural Book Conversation (pinned) ──
  // 13. r/books weekly thread breakout titles
  { match: /r\/books.*What Are You Reading/i, photos: ["photo-1543002588-bfa74002ed7e"] },
  // 14. r/suggestmeabook dark academia
  { match: /r\/suggestmeabook.*Dark Academia/i, photos: ["photo-1600880292203-757bb62b4baf"] },
  // 15. r/CanLit Giller Prize pre-orders
  { match: /r\/CanLit.*Giller Prize/i, photos: ["photo-1526243741027-444d633d7365"] },
  // Social loop
  // 34. r/bookshelf reading nook posts
  { match: /r\/bookshelf.*Reading Nook/i, photos: ["photo-1535016120720-40c646be5580"] },
  // 35. r/CanadianBookClub grows to 180K
  { match: /r\/CanadianBookClub.*180K/i, photos: ["photo-1497633762265-9d179a990aa6"] },
  // 36. r/RomanceBooks enemies-to-lovers
  { match: /r\/RomanceBooks.*Enemies/i, photos: ["photo-1529590003495-b2646e2718bf"] },

  // ── Gifting, Lifestyle & Home (pinned) ──
  // 16. Emotional-value gifting
  { match: /Emotional-Value Gifting/i, photos: ["photo-1557804506-669a67965ba0"] },
  // 17. Mother's Day gift search
  { match: /Mother.*Day Gift Search/i, photos: ["photo-1531983412531-1f49a365ffed"] },
  // 18. Cozy living / dopamine décor
  { match: /Cozy Living.*Dopamine/i, photos: ["photo-1513185041617-8ab03f83d6c5"] },
  // Gifting loop
  // 37. Teacher appreciation / graduation
  { match: /Teacher Appreciation.*Graduation/i, photos: ["photo-1513542789411-b6a5d4f31634"] },
  // 38. Personalization trend / journals
  { match: /Personalization Trend.*Premium/i, photos: ["photo-1531346878377-a5be20888e57"] },
  // 39. Baby gifting market
  { match: /Baby Gifting Market/i, photos: ["photo-1515488042361-ee00e0ddd4e4"] },

  // ── Macro Consumer & Retail (pinned) ──
  // 19. Consumer confidence dips Q1
  { match: /Consumer Confidence Dips/i, photos: ["photo-1460925895917-afdab827c52f"] },
  // 20. E-commerce 14.2% / omnichannel
  { match: /E-Commerce Share.*14\.2/i, photos: ["photo-1556742393-d75f468bfcb0"] },
  // 21. Mall foot traffic stabilizes
  { match: /Mall Foot Traffic Stabilizes/i, photos: ["photo-1441984904996-e0b6ba687e04"] },
  // Macro loop
  // 40. Holiday spending forecast cautious
  { match: /Holiday Spending Forecast/i, photos: ["photo-1607083206968-13611e3d76db"] },
  // 41. Inflation sensitivity / book spending resilient
  { match: /Inflation Sensitivity.*Book Spending/i, photos: ["photo-1551288049-bebda4e38f71"] },
  // 42. Convenience expectations / same-day
  { match: /Convenience Expectations.*Same-Day/i, photos: ["photo-1586528116311-ad8dd3c8310d"] },
];

const FALLBACK_PHOTOS = [
  "photo-1488190211105-8b0e65b80b4e",
  "photo-1432821596592-e2c18b78144f",
  "photo-1434030216411-0b793f4b4173",
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function photoToUrl(photo: string, w: number, h: number): string {
  if (photo.startsWith("http")) return photo;
  return `https://images.unsplash.com/${photo}?w=${w}&h=${h}&fit=crop&auto=format`;
}

function articleImageUrl(title: string, id: string): string {
  const idx = hashId(id);
  for (const entry of CURATED_IMAGES) {
    if (entry.match.test(title)) {
      const photo = entry.photos[idx % entry.photos.length];
      return photoToUrl(photo, 640, 400);
    }
  }
  const photo = FALLBACK_PHOTOS[idx % FALLBACK_PHOTOS.length];
  return photoToUrl(photo, 640, 400);
}

// Larger version for the modal hero
function articleImageUrlLarge(title: string, id: string): string {
  const idx = hashId(id);
  for (const entry of CURATED_IMAGES) {
    if (entry.match.test(title)) {
      const photo = entry.photos[idx % entry.photos.length];
      return photoToUrl(photo, 1200, 500);
    }
  }
  const photo = FALLBACK_PHOTOS[idx % FALLBACK_PHOTOS.length];
  return photoToUrl(photo, 1200, 500);
}

// ─── AI Insight generator (deterministic from article) ──────────────────────

const TAG_LABELS: Record<NewsTag, string> = {
  brand: "Brand & Corporate Narrative",
  publishing: "Book Industry & Publishing",
  genre: "Genre & Title Momentum",
  amazon: "Amazon Intelligence",
  social: "Social & Cultural Conversation",
  gifting: "Gifting, Lifestyle & Home",
  macro: "Macro Consumer & Retail",
};

function generateInsight(item: NewsItem): { impact: string; actions: Array<{ icon: React.ElementType; title: string; description: string }> } {
  const tag = item.tags[0];

  if (tag === "brand") {
    return {
      impact: "This signals a shift in how the market perceives Indigo's brand narrative. Whether it's store format changes, executive positioning, loyalty evolution, or sustainability messaging, every public-facing signal shapes market confidence and customer expectation. Indigo's ability to control this narrative directly affects brand equity, investor sentiment, and competitive positioning.",
      actions: [
        { icon: TrendingUp, title: "Amplify Positive Brand Signals", description: "If the narrative is favourable, accelerate owned and paid amplification. Feature the story across Indigo's social channels and align PR with the momentum before it fades." },
        { icon: Target, title: "Track Narrative Trajectory", description: "Monitor whether this story is being picked up by other outlets and how the tone is shifting. Flag any divergence between Indigo's intended positioning and how the market is interpreting it." },
        { icon: Shield, title: "Prepare Counter-Narrative if Needed", description: "If sentiment is negative or mixed, draft response messaging and identify owned channels to reinforce the brand's intended narrative around curation, Canadian identity, and customer experience." },
      ],
    };
  }
  if (tag === "publishing") {
    return {
      impact: "Canada's publishing industry revenue rose to $1.7B in 2024, with continued benefit from digital reading formats and social media influence. Shifts in publishing — from genre acceleration to digital format adoption to backlist resurgence — have direct implications for Indigo's assortment strategy, merchandising decisions, and demand forecasting.",
      actions: [
        { icon: TrendingUp, title: "Align Assortment to Industry Momentum", description: "Cross-reference this publishing shift against Indigo's current category performance. If a format or genre is accelerating industry-wide, ensure Indigo's merchandising and inventory reflect the trend before competitors respond." },
        { icon: Target, title: "Monitor Digital Format Disruption", description: "Track audiobook and eReading adoption rates relative to physical book sales. Identify where digital is complementing vs. cannibalising physical, and adjust channel strategy accordingly." },
        { icon: Shield, title: "Watch for Backlist Opportunities", description: "Publishing shifts often create backlist resurgence — older titles that suddenly spike due to adaptations, social buzz, or cultural moments. Flag any backlist acceleration for merchandising consideration." },
      ],
    };
  }
  if (tag === "genre") {
    return {
      impact: "Genre and title momentum tracking helps Indigo move from reacting to bestsellers to anticipating demand. Recent market signals show continued genre volatility and culturally driven surges, especially around BookTok-led categories, adaptation-driven spikes, and breakout subgenres. Catching these signals early means better inventory positioning, smarter merchandising, and more relevant marketing.",
      actions: [
        { icon: TrendingUp, title: "Anticipate Demand — Don't Chase It", description: "If a genre or author is showing breakout signals, ensure Indigo's inventory and merchandising are ahead of the curve. Position featured titles prominently before the wave peaks." },
        { icon: Target, title: "Cross-Reference with Social Signals", description: "Check whether this genre momentum is being amplified on BookTok, Goodreads, or Reddit. Social amplification accelerates demand velocity and shortens the window to capture it." },
        { icon: Shield, title: "Flag Seasonal and Adaptation Triggers", description: "Track upcoming film/TV adaptations, seasonal reading themes, and award cycles. These are predictable demand drivers that Indigo can merchandise against with lead time." },
      ],
    };
  }
  if (tag === "amazon") {
    return {
      impact: "Amazon often acts as a real-time proxy for consumer demand velocity, even though Indigo curates differently. Bestseller movements, new release surges, review velocity, and category climbing on Amazon.ca reveal what consumers are actively seeking — and where Indigo can compete on curation, experience, and exclusivity rather than price alone.",
      actions: [
        { icon: TrendingUp, title: "Map Amazon Demand to Indigo Opportunity", description: "Cross-reference Amazon's trending titles and categories against Indigo's current assortment and inventory. Identify gaps where demand is proven but Indigo's positioning could capture share." },
        { icon: Target, title: "Track Review Volume as a Leading Indicator", description: "Rapid review accumulation on Amazon often precedes mainstream breakout. Flag titles with accelerating review velocity for early merchandising consideration and marketing alignment." },
        { icon: Shield, title: "Differentiate on Curation, Not Price", description: "Amazon competes on convenience and price. Indigo's response should emphasise curated collections, staff picks, exclusive editions, and the in-store discovery experience that Amazon cannot replicate." },
      ],
    };
  }
  if (tag === "social") {
    return {
      impact: "Book discovery is increasingly community-driven. Reddit reading communities — r/books, r/suggestmeabook, r/RomanceBooks, r/CanLit — are surfacing high-conviction recommendations that drive real purchasing behaviour. Unlike algorithmic feeds, Reddit threads represent genuine reader enthusiasm with detailed context on why a book resonates. This matters because Indigo's merchandising and marketing can align not just to what is selling, but to why readers are passionate about it.",
      actions: [
        { icon: TrendingUp, title: "Align Merchandising to Community Conversation", description: "If a title, trope, or aesthetic is gaining traction on Reddit, ensure Indigo's merchandising and marketing reflect the language and framing the community is using. Reddit-driven demand is high-conviction and specific." },
        { icon: Target, title: "Monitor Subreddit Recommendation Velocity", description: "Track which titles and genres are gaining momentum across key book subreddits. High upvote counts and comment velocity on recommendation threads are leading indicators of mainstream breakout." },
        { icon: Shield, title: "Watch for Emerging Aesthetic and Trope Trends", description: "Reddit book conversation often organises around aesthetics (dark academia, cottagecore) and tropes (enemies-to-lovers, found family). These are merchandisable themes Indigo can build collections and campaigns around." },
      ],
    };
  }
  if (tag === "gifting") {
    return {
      impact: "Indigo has a meaningful gifts, lifestyle, and home business. Current retail trend coverage points to cautious spending, convenience expectations, and emotional-value gifting. Monitoring gifting intent, seasonal celebration moments, and lifestyle aesthetics helps Indigo position its non-book assortment as intentional, curated, and emotionally resonant — not just transactional.",
      actions: [
        { icon: TrendingUp, title: "Align to Seasonal Gift Intent", description: "Track upcoming gifting moments — Mother's Day, graduation, teacher gifts, holiday — and ensure merchandising and marketing are positioned with lead time. Gift-intent search spikes are predictable and actionable." },
        { icon: Target, title: "Monitor Lifestyle Aesthetic Trends", description: "Track trending aesthetics — cozy living, dopamine décor, self-care rituals, personalization — and align Indigo's lifestyle and home merchandising to the cultural conversation driving purchase decisions." },
        { icon: Shield, title: "Position Indigo as the Curated Gift Destination", description: "In a cautious spending environment, consumers gravitate toward gifts with emotional value. Indigo's curation, private labels (Love & Lore, Nota), and book-lover lifestyle positioning are competitive advantages worth amplifying." },
      ],
    };
  }
  if (tag === "macro") {
    return {
      impact: "Macro consumer and retail conditions directly shape Indigo's performance pressure points: value perception, conversion rates, category mix, and promotional strategy. Canadian retail commentary in early 2026 points to cautious spending, rising convenience expectations, and e-commerce channel shifting. Understanding these forces helps STRATIS connect external conditions to strategic response.",
      actions: [
        { icon: TrendingUp, title: "Adjust Strategy to Spending Climate", description: "If consumer confidence is declining or discretionary spending is under pressure, shift messaging toward value, emotional gifting, and experience — away from volume and impulse." },
        { icon: Target, title: "Monitor Foot Traffic and Channel Shifts", description: "Track mall retail trends and e-commerce vs. in-store behaviour. Shifts in channel preference have direct implications for Indigo's omnichannel strategy and marketing budget allocation." },
        { icon: Shield, title: "Flag Holiday and Seasonal Spending Signals Early", description: "Early indicators of holiday spending sentiment — from consumer surveys to credit card data — help Indigo calibrate promotional intensity, inventory depth, and campaign timing." },
      ],
    };
  }
  // default
  return {
    impact: "This development has strategic implications for Indigo's positioning. Staying ahead of market shifts, consumer behaviour changes, and competitive dynamics ensures Indigo can respond proactively rather than reactively.",
    actions: [
      { icon: TrendingUp, title: "Assess Strategic Impact", description: "Evaluate how this development affects Indigo's current priorities and whether it warrants a change in approach across merchandising, marketing, or operations." },
      { icon: Target, title: "Cross-Reference with Other Signals", description: "Check whether this signal is being confirmed by other data sources — social conversation, sales data, competitor behaviour — to determine confidence level before acting." },
      { icon: Shield, title: "Monitor for Escalation", description: "Track whether this signal is intensifying, stabilising, or fading. Set a review point to reassess impact and determine next steps." },
    ],
  };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const store = useMemo(() => generateAllData(), []);
  const newsItems = store.newsItems;

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedArticle(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const sections = useMemo(() => {
    const used = new Set<string>();
    return FEED_SECTIONS.map((section) => {
      const items = newsItems.filter((item) => {
        if (used.has(item.id)) return false;
        if (section.filterFn(item)) {
          used.add(item.id);
          return true;
        }
        return false;
      });
      return { ...section, items: items.slice(0, 6) };
    }).filter((s) => s.items.length > 0);
  }, [newsItems]);

  if (loading) {
    return (
      <div className="space-y-10 px-2">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="grid grid-cols-3 gap-5">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-3">
                  <Skeleton className="h-44 rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const insight = selectedArticle ? generateInsight(selectedArticle) : null;

  return (
    <>
      <div className="space-y-12 px-2">
        {sections.map((section) => {
          const sourcesDisplay = section.sources.slice(0, 3).join(", ");
          const moreCount = Math.max(0, section.sources.length - 3);
          const unreadCount = section.items.length;

          return (
            <div key={section.id}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="text-lg font-bold">{section.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Monitoring: {sourcesDisplay}
                    {moreCount > 0 && <>, and {moreCount} more</>}
                    .{" "}
                    <button className="text-foreground underline underline-offset-2 hover:text-teal transition-colors">Edit</button>
                  </p>
                </div>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-1">
                  View all ({unreadCount} unread) <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-5 mt-4">
                {section.items.slice(0, 3).map((item) => {
                  const date = new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedArticle(item)}
                      className="group rounded-xl border border-border/40 bg-card overflow-hidden hover:border-border/60 hover:shadow-lg hover:shadow-black/10 transition-all cursor-pointer"
                    >
                      <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={articleImageUrl(item.title, item.id)}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="text-sm font-semibold leading-snug mb-2 line-clamp-2 group-hover:text-teal transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-4">
                          <span className="font-medium text-muted-foreground/80">{item.source}</span>
                          {" "}• {date} • {item.summary}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Article Detail Modal ─── */}
      {selectedArticle && insight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] bg-card border border-border/40 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero image */}
            <div className="relative h-56 shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={articleImageUrlLarge(selectedArticle.title, selectedArticle.id)}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

              {/* Close button */}
              <button
                onClick={() => setSelectedArticle(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Tags */}
              <div className="absolute bottom-4 left-6 flex items-center gap-2">
                {selectedArticle.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-semibold text-white/90 bg-white/15 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-full">
                    {TAG_LABELS[tag]}
                  </span>
                ))}
                <span className={cn(
                  "text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm",
                  selectedArticle.urgency === "high" ? "text-red-300 bg-red-500/20 border border-red-500/20" :
                  selectedArticle.urgency === "medium" ? "text-amber-300 bg-amber-500/20 border border-amber-500/20" :
                  "text-white/70 bg-white/10 border border-white/10"
                )}>
                  {selectedArticle.urgency.charAt(0).toUpperCase() + selectedArticle.urgency.slice(1)} Priority
                </span>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-auto px-6 pb-6">
              {/* Article header */}
              <div className="pt-4 pb-5">
                <h2 className="text-xl font-bold leading-tight mb-3">{selectedArticle.title}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">{selectedArticle.source}</span>
                  <span>•</span>
                  <span>{new Date(selectedArticle.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                </div>
              </div>

              {/* Article body */}
              <div className="space-y-4 mb-6">
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedArticle.summary}</p>
                {selectedArticle.competitor && (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/10">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300/80">
                      <span className="font-semibold text-red-400">Competitor Alert:</span> This article involves <span className="font-semibold">{selectedArticle.competitor}</span>, a competing retailer in Indigo&apos;s market.
                    </p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border/30 my-6" />

              {/* STRATIS Insight */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal/20 to-emerald-500/10 border border-teal/20 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-teal" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">STRATIS Insight</h3>
                    <p className="text-[10px] text-muted-foreground/60">What this means for Indigo</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-2">{insight.impact}</p>

                {/* Why it matters callout */}
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-teal/5 border border-teal/10 mb-6">
                  <TrendingUp className="h-4 w-4 text-teal shrink-0 mt-0.5" />
                  <p className="text-xs text-teal/80">
                    <span className="font-semibold text-teal">Why it matters:</span> {selectedArticle.whyItMatters}
                  </p>
                </div>

                {/* Recommended actions */}
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-3">Recommended Actions</h4>
                <div className="space-y-3">
                  {insight.actions.map((action, i) => (
                    <div key={i} className="group/action flex items-start gap-3 p-4 rounded-xl bg-muted/20 border border-border/20 hover:border-teal/20 hover:bg-teal/5 transition-all cursor-pointer">
                      <div className="w-8 h-8 rounded-lg bg-teal/10 border border-teal/10 flex items-center justify-center shrink-0 mt-0.5">
                        <action.icon className="h-4 w-4 text-teal" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-semibold">{action.title}</h5>
                          <ArrowRight className="h-3 w-3 text-teal opacity-0 group-hover/action:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{action.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="shrink-0 border-t border-border/30 px-6 py-3 flex items-center justify-between bg-card">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <Bookmark className="h-3.5 w-3.5" /> Save
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" /> Source
                </button>
              </div>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal text-white text-xs font-semibold hover:bg-teal/90 transition-colors">
                <Sparkles className="h-3.5 w-3.5" /> Generate Insight Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
