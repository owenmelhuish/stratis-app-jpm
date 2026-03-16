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
    id: "qsr",
    title: "QSR Industry & Market Trends",
    sources: ["QSR Magazine", "Technomic", "Foodservice & Hospitality", "Restaurants Canada"],
    filterFn: (item) => item.tags.includes("qsr"),
  },
  {
    id: "menu",
    title: "Menu Innovation & Food Trends",
    sources: ["Technomic", "QSR Magazine", "Food in Canada", "Restaurants Canada"],
    filterFn: (item) => item.tags.includes("menu"),
  },
  {
    id: "delivery",
    title: "Delivery Platform Intelligence",
    sources: ["UberEats Data", "DoorDash Insights", "SkipTheDishes Analytics", "Technomic"],
    filterFn: (item) => item.tags.includes("delivery"),
  },
  {
    id: "social",
    title: "Social & Food Culture",
    sources: ["Reddit r/pizza", "Reddit r/foodToronto", "Reddit r/CanadianFood", "TikTok #FoodTok"],
    filterFn: (item) => item.tags.includes("social"),
  },
  {
    id: "sports",
    title: "Sports, Events & Partnerships",
    sources: ["TSN", "Sportsnet", "Retail Insider", "Strategy Online"],
    filterFn: (item) => item.tags.includes("sports"),
  },
  {
    id: "sponsorships",
    title: "Corporate Sponsorships",
    sources: ["TSN", "Sportsnet", "The Athletic", "CFL.ca", "PWHL News"],
    filterFn: (item) => item.tags.includes("sponsorships"),
  },
  {
    id: "competitors",
    title: "Competitor Watch",
    sources: ["Retail Insider", "QSR Magazine", "RedFlagDeals", "Financial Post", "Technomic"],
    filterFn: (item) => item.tags.includes("competitors"),
  },
  {
    id: "macro",
    title: "Macro Consumer & QSR Environment",
    sources: ["Statistics Canada", "The Globe and Mail", "Financial Post", "Deloitte Canada"],
    filterFn: (item) => item.tags.includes("macro"),
  },
];

// ─── Contextual image URL from article title ────────────────────────────────

const CURATED_IMAGES: Array<{ match: RegExp; photos: string[] }> = [
  // ── Brand & Corporate Narrative (pinned) — QSR/pizza imagery ──
  { match: /CEO Interview.*QSR Expansion/i, photos: ["photo-1565299624946-b28f40a0ae38"] },
  { match: /Pizza Pizza Club.*Surpasses/i, photos: ["photo-1604382354936-07c5d9983bd3"] },
  { match: /ESG Report.*Sustainable Packaging/i, photos: ["photo-1559526324-4b87b5e36e44"] },
  // Brand loop
  { match: /Viral TikTok.*Delivery Challenge/i, photos: ["photo-1513104890138-7c749659a591"] },
  { match: /Opens 15 New Locations/i, photos: ["photo-1555396273-367ea4eb4db5"] },
  { match: /NHL Team.*Game Day Combo/i, photos: ["photo-1574071318508-1cdbab80d002"] },

  // ── QSR Industry & Market Trends (pinned) ──
  { match: /Canadian QSR Revenue.*\$38B/i, photos: ["photo-1552566626-52f8b828add9"] },
  { match: /Third-Party Delivery Commission/i, photos: ["photo-1526367790999-0150786686a2"] },
  { match: /Value Menu Resurgence/i, photos: ["photo-1571407970349-bc81e7e96d47"] },
  // QSR loop
  { match: /Independent QSR Operators.*22%/i, photos: ["photo-1590947132387-155cc02f3212"] },
  { match: /Ghost Kitchen Model/i, photos: ["photo-1567620905732-2d1ec7ab7445"] },
  { match: /Pizza as Most-Ordered/i, photos: ["photo-1528137871618-79d2761e3fd5"] },

  // ── Menu Innovation & Food Trends (pinned) ──
  { match: /Plant-Based Pizza Demand/i, photos: ["photo-1574071318508-1cdbab80d002"] },
  { match: /Loaded Crust.*Premium Toppings/i, photos: ["photo-1565299624946-b28f40a0ae38"] },
  { match: /Detroit-Style Deep Dish/i, photos: ["photo-1513104890138-7c749659a591"] },
  // Menu loop
  { match: /Spicy and Global Flavour/i, photos: ["photo-1604382354936-07c5d9983bd3"] },
  { match: /Breakfast Pizza.*Demand Surge/i, photos: ["photo-1552566626-52f8b828add9"] },
  { match: /Pizza Subscription Models/i, photos: ["photo-1571407970349-bc81e7e96d47"] },

  // ── Delivery Platform Intelligence (pinned) ──
  { match: /UberEats.*Pizza Holds 3 of Top 5/i, photos: ["photo-1526367790999-0150786686a2"] },
  { match: /DoorDash.*Healthy Pizza.*Cauliflower/i, photos: ["photo-1590947132387-155cc02f3212"] },
  { match: /SkipTheDishes.*Daypart/i, photos: ["photo-1567620905732-2d1ec7ab7445"] },
  // Delivery loop
  { match: /UberEats.*Pizza Bundle Orders/i, photos: ["photo-1528137871618-79d2761e3fd5"] },
  { match: /DoorDash Order Velocity/i, photos: ["photo-1555396273-367ea4eb4db5"] },
  { match: /SkipTheDishes Late-Night/i, photos: ["photo-1513104890138-7c749659a591"] },

  // ── Social & Food Culture (pinned) ──
  { match: /r\/pizza.*Go-To Order/i, photos: ["photo-1565299624946-b28f40a0ae38"] },
  { match: /r\/foodToronto.*Late-Night Pizza/i, photos: ["photo-1604382354936-07c5d9983bd3"] },
  { match: /r\/CanadianFood.*Regional Pizza/i, photos: ["photo-1574071318508-1cdbab80d002"] },
  // Social loop
  { match: /r\/pizza.*Pizza Hack/i, photos: ["photo-1552566626-52f8b828add9"] },
  { match: /r\/foodToronto Grows to 280K/i, photos: ["photo-1590947132387-155cc02f3212"] },
  { match: /TikTok #PizzaReview/i, photos: ["photo-1571407970349-bc81e7e96d47"] },

  // ── Sports, Events & Partnerships (pinned) ──
  { match: /Game Day Pizza Orders Surge/i, photos: ["photo-1574071318508-1cdbab80d002"] },
  { match: /Super Bowl Pizza Demand/i, photos: ["photo-1565299624946-b28f40a0ae38"] },
  { match: /Raptors Partnership.*Arena/i, photos: ["photo-1546519638-68e109498ffc"] },
  // Sports loop
  { match: /March Madness.*NHL Playoffs.*Catering/i, photos: ["photo-1526367790999-0150786686a2"] },
  { match: /Sports Sponsorship ROI/i, photos: ["photo-1528137871618-79d2761e3fd5"] },
  { match: /FIFA World Cup 2026/i, photos: ["photo-1555396273-367ea4eb4db5"] },

  // ── Corporate Sponsorships (pinned) ──
  { match: /Maple Leafs Playoff Push/i, photos: ["photo-1552566626-52f8b828add9"] },
  { match: /PWHL Championship Series/i, photos: ["photo-1515703407324-5f753afd8be8"] },
  { match: /BC Lions.*Season Opener/i, photos: ["photo-1487466365202-1afdb86c764e"] },
  // Sponsorships loop
  { match: /Maple Leafs Star Signs Extension/i, photos: ["photo-1552566626-52f8b828add9"] },
  { match: /PWHL Toronto.*Community Arena/i, photos: ["photo-1515703407324-5f753afd8be8"] },
  { match: /Grey Cup Week Programming/i, photos: ["photo-1487466365202-1afdb86c764e"] },

  // ── Competitor Watch (pinned) ──
  { match: /Domino.*Emergency Pizza/i, photos: ["photo-1571407970349-bc81e7e96d47"] },
  { match: /Pizza Nova.*200 Locations/i, photos: ["photo-1590947132387-155cc02f3212"] },
  { match: /Pizza Hut.*Lunch Combo/i, photos: ["photo-1528137871618-79d2761e3fd5"] },
  // Competitors loop
  { match: /Domino.*15-Minute Delivery/i, photos: ["photo-1567620905732-2d1ec7ab7445"] },
  { match: /Pizza Nova.*Toppings Bar/i, photos: ["photo-1565299624946-b28f40a0ae38"] },
  { match: /Pizza Hut.*DoorDash.*Bundle/i, photos: ["photo-1526367790999-0150786686a2"] },

  // ── Macro Consumer & QSR (pinned) ──
  { match: /Consumer Confidence Dips/i, photos: ["photo-1460925895917-afdab827c52f"] },
  { match: /Digital Ordering Share.*38%/i, photos: ["photo-1556742393-d75f468bfcb0"] },
  { match: /QSR Foot Traffic Stabilizes/i, photos: ["photo-1441984904996-e0b6ba687e04"] },
  // Macro loop
  { match: /Holiday Spending Forecast/i, photos: ["photo-1607083206968-13611e3d76db"] },
  { match: /Inflation Sensitivity.*QSR Pizza/i, photos: ["photo-1551288049-bebda4e38f71"] },
  { match: /Convenience Expectations.*Sub-30/i, photos: ["photo-1586528116311-ad8dd3c8310d"] },
];

const FALLBACK_PHOTOS = [
  "photo-1565299624946-b28f40a0ae38",
  "photo-1513104890138-7c749659a591",
  "photo-1574071318508-1cdbab80d002",
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
  qsr: "QSR Industry & Market Trends",
  menu: "Menu Innovation & Food Trends",
  delivery: "Delivery Platform Intelligence",
  social: "Social & Food Culture",
  sports: "Sports, Events & Partnerships",
  sponsorships: "Corporate Sponsorships",
  competitors: "Competitor Watch",
  macro: "Macro Consumer & QSR",
};

function generateInsight(item: NewsItem): { impact: string; actions: Array<{ icon: React.ElementType; title: string; description: string }> } {
  const tag = item.tags[0];

  if (tag === "brand") {
    return {
      impact: "This signals a shift in how the market perceives Pizza Pizza's brand narrative. Whether it's expansion strategy, executive positioning, loyalty evolution, or sustainability messaging, every public-facing signal shapes market confidence and customer expectation. Pizza Pizza's ability to control this narrative directly affects brand equity, franchisee sentiment, and competitive positioning.",
      actions: [
        { icon: TrendingUp, title: "Amplify Positive Brand Signals", description: "If the narrative is favourable, accelerate owned and paid amplification. Feature the story across Pizza Pizza's social channels and align PR with the momentum before it fades." },
        { icon: Target, title: "Track Narrative Trajectory", description: "Monitor whether this story is being picked up by other outlets and how the tone is shifting. Flag any divergence between Pizza Pizza's intended positioning and how the market is interpreting it." },
        { icon: Shield, title: "Prepare Counter-Narrative if Needed", description: "If sentiment is negative or mixed, draft response messaging and identify owned channels to reinforce the brand's intended narrative around value, Canadian identity, and delivery excellence." },
      ],
    };
  }
  if (tag === "qsr") {
    return {
      impact: "Canada's QSR industry revenue reached $38B in 2024, with continued growth from digital ordering and delivery platforms. Shifts in the QSR landscape — from value menu resurgence to delivery commission pressures to ghost kitchen expansion — have direct implications for Pizza Pizza's pricing strategy, channel mix, and competitive positioning.",
      actions: [
        { icon: TrendingUp, title: "Align Strategy to Industry Momentum", description: "Cross-reference this QSR industry shift against Pizza Pizza's current performance. If a trend is accelerating industry-wide, ensure Pizza Pizza's marketing and menu strategy reflect it before competitors respond." },
        { icon: Target, title: "Monitor Delivery Platform Dynamics", description: "Track delivery commission rates, platform market share shifts, and direct-ordering adoption rates. Identify where delivery platform changes create opportunity or risk for Pizza Pizza's margins." },
        { icon: Shield, title: "Watch for Competitive Threats", description: "QSR industry shifts often create competitive openings — new entrants, ghost kitchens, or format innovations. Flag emerging competitive threats for strategic evaluation." },
      ],
    };
  }
  if (tag === "menu") {
    return {
      impact: "Menu innovation and food trend tracking helps Pizza Pizza move from reacting to trends to anticipating demand. Recent signals show continued consumer interest in plant-based options, premium toppings, global flavours, and new pizza styles. Catching these signals early means better menu positioning, smarter LTO planning, and more relevant marketing.",
      actions: [
        { icon: TrendingUp, title: "Anticipate Demand — Don't Chase It", description: "If a flavour profile or pizza style is showing breakout signals, ensure Pizza Pizza's menu innovation pipeline and marketing creative are ahead of the curve before the trend peaks." },
        { icon: Target, title: "Cross-Reference with Social Signals", description: "Check whether this menu trend is being amplified on TikTok, Reddit, or food blogs. Social amplification accelerates demand velocity and shortens the window to capture it." },
        { icon: Shield, title: "Flag Seasonal and Cultural Triggers", description: "Track upcoming cultural moments, sports seasons, and seasonal preferences. These are predictable demand drivers that Pizza Pizza can build LTOs and campaigns around with lead time." },
      ],
    };
  }
  if (tag === "delivery") {
    return {
      impact: "Delivery platforms act as real-time proxies for consumer demand velocity. Order patterns, search trends, daypart shifts, and category rankings on UberEats, DoorDash, and SkipTheDishes reveal what consumers are actively craving — and where Pizza Pizza can compete on speed, value, and direct ordering rather than platform dependence alone.",
      actions: [
        { icon: TrendingUp, title: "Map Platform Demand to Pizza Pizza Opportunity", description: "Cross-reference delivery platform trending items and categories against Pizza Pizza's current menu and promotions. Identify gaps where demand is proven but Pizza Pizza's positioning could capture more share." },
        { icon: Target, title: "Track Order Velocity as a Leading Indicator", description: "Rapid order volume growth on delivery platforms often precedes mainstream demand shifts. Flag trending items and daypart patterns for early promotional consideration and menu alignment." },
        { icon: Shield, title: "Differentiate on Direct Ordering", description: "Delivery platforms compete on convenience but take 25-30% commission. Pizza Pizza's response should emphasise direct ordering through the app and website — better value for customers, better margins for the business." },
      ],
    };
  }
  if (tag === "social") {
    return {
      impact: "Food discovery is increasingly community-driven. Reddit food communities — r/pizza, r/foodToronto, r/CanadianFood — and TikTok food creators are surfacing high-conviction opinions that drive real ordering behaviour. Unlike algorithmic feeds, these communities represent genuine food enthusiasm with detailed context on why a brand or item resonates. This matters because Pizza Pizza's marketing can align not just to what is trending, but to why consumers are passionate about it.",
      actions: [
        { icon: TrendingUp, title: "Align Marketing to Community Conversation", description: "If a pizza style, topping, or brand mention is gaining traction on Reddit or TikTok, ensure Pizza Pizza's marketing reflects the language and framing the community is using. Community-driven demand is high-conviction and specific." },
        { icon: Target, title: "Monitor Community Sentiment Velocity", description: "Track which brands, items, and trends are gaining momentum across key food communities. High upvote counts and comment velocity on recommendation threads are leading indicators of mainstream demand." },
        { icon: Shield, title: "Watch for Emerging Food Trends and Hacks", description: "Social food conversation often organises around hacks, customisations, and aesthetic presentations. These are marketable themes Pizza Pizza can build UGC campaigns and social content around." },
      ],
    };
  }
  if (tag === "sports") {
    return {
      impact: "Pizza and sports are deeply connected in consumer behaviour. Game day ordering spikes, sports partnership ROI, and event-driven catering demand represent predictable, high-volume revenue opportunities. Monitoring sports calendars, partnership effectiveness, and fan engagement patterns helps Pizza Pizza capture the full value of sports-driven demand moments.",
      actions: [
        { icon: TrendingUp, title: "Align to Sports Calendar Demand", description: "Track upcoming sports events — NHL playoffs, Super Bowl, FIFA World Cup, March Madness — and ensure promotional campaigns, catering offers, and delivery capacity are positioned with lead time." },
        { icon: Target, title: "Monitor Sports Partnership ROI", description: "Track brand recall, order frequency lift, and social engagement from sports partnerships and sponsorships. Optimise activation spend based on measured impact rather than awareness assumptions." },
        { icon: Shield, title: "Position Pizza Pizza as the Game Day Destination", description: "Sports-driven pizza demand is massive and predictable. Pizza Pizza's delivery fleet, group ordering capabilities, and party platter options are competitive advantages worth amplifying across all sports moments." },
      ],
    };
  }
  if (tag === "competitors") {
    return {
      impact: "Competitor activity from Domino's, Pizza Nova, and Pizza Hut directly affects Pizza Pizza's market position, pricing perception, and customer acquisition. Promotional launches, expansion moves, and platform strategies from these competitors signal where the competitive pressure is intensifying — and where Pizza Pizza has an opportunity to differentiate or defend.",
      actions: [
        { icon: TrendingUp, title: "Assess Competitive Threat Level", description: "Evaluate whether this competitor move targets a segment, daypart, or market where Pizza Pizza has significant share. Determine if it requires a defensive response or if Pizza Pizza's existing positioning is sufficient." },
        { icon: Target, title: "Monitor Customer Response", description: "Track whether this competitor promotion is shifting order volume, app downloads, or search share in overlapping markets. Real-time delivery and ordering data will show impact faster than brand tracking studies." },
        { icon: Shield, title: "Identify Differentiation Opportunity", description: "Every competitor move reveals their strategic priorities — and their blind spots. Identify where Pizza Pizza's strengths (direct ordering, loyalty program, delivery fleet, Canadian brand identity) create defensible advantages the competitor cannot easily replicate." },
      ],
    };
  }
  if (tag === "sponsorships") {
    return {
      impact: "Pizza Pizza's corporate sponsorships with the Toronto Maple Leafs, PWHL, and BC Lions create high-visibility activation windows tied to fan passion and cultural moments. League milestones, playoff runs, player signings, and community events each represent opportunities to convert sponsorship investment into brand engagement, app downloads, and order volume. The key is activating in real time — fan emotions peak during these moments and fade quickly.",
      actions: [
        { icon: TrendingUp, title: "Activate Around the Moment", description: "Coordinate real-time social content, push notifications, and geo-targeted promotions tied to this event. Fan engagement peaks during and immediately after key moments — speed of activation determines share of the demand spike." },
        { icon: Target, title: "Leverage Partner Assets", description: "Use co-branded content, player appearances, and in-arena activations to extend reach beyond paid media. Sponsorship assets are most valuable when integrated into organic fan conversation, not just displayed as logos." },
        { icon: Shield, title: "Measure Sponsorship ROI", description: "Track order volume, app downloads, loyalty sign-ups, and social engagement lift during and after activation windows. Build a sponsorship performance baseline to optimise future investment across the Maple Leafs, PWHL, and BC Lions partnerships." },
      ],
    };
  }
  if (tag === "macro") {
    return {
      impact: "Macro consumer and QSR conditions directly shape Pizza Pizza's performance pressure points: value perception, order frequency, channel mix, and promotional strategy. Canadian QSR commentary in early 2026 points to cautious spending, rising convenience expectations, and digital ordering channel shifting. Understanding these forces helps STRATIS connect external conditions to strategic response.",
      actions: [
        { icon: TrendingUp, title: "Adjust Strategy to Spending Climate", description: "If consumer confidence is declining or food-away-from-home spending is under pressure, shift messaging toward value, convenience, and everyday affordability — away from premium and impulse." },
        { icon: Target, title: "Monitor Ordering Channel Shifts", description: "Track digital ordering adoption, delivery vs. pickup behaviour, and platform market share shifts. Changes in channel preference have direct implications for Pizza Pizza's marketing budget allocation." },
        { icon: Shield, title: "Flag Seasonal Demand Signals Early", description: "Early indicators of holiday ordering patterns, sports season demand, and catering trends help Pizza Pizza calibrate promotional intensity, delivery capacity, and campaign timing." },
      ],
    };
  }
  // default
  return {
    impact: "This development has strategic implications for Pizza Pizza's positioning. Staying ahead of market shifts, consumer behaviour changes, and competitive dynamics ensures Pizza Pizza can respond proactively rather than reactively.",
    actions: [
      { icon: TrendingUp, title: "Assess Strategic Impact", description: "Evaluate how this development affects Pizza Pizza's current priorities and whether it warrants a change in approach across menu strategy, marketing, or operations." },
      { icon: Target, title: "Cross-Reference with Other Signals", description: "Check whether this signal is being confirmed by other data sources — social conversation, ordering data, competitor behaviour — to determine confidence level before acting." },
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
                      <span className="font-semibold text-red-400">Competitor Alert:</span> This article involves <span className="font-semibold">{selectedArticle.competitor}</span>, a competing brand in Pizza Pizza&apos;s market.
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
                    <p className="text-[10px] text-muted-foreground/60">What this means for Pizza Pizza</p>
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
