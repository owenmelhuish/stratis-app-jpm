import { subDays, format, differenceInDays } from 'date-fns';
import type {
  RegionId, ChannelId, Campaign, CampaignObjective, CampaignStatus,
  DailyMetrics, AggregatedKPIs, KPIDelta, KPIKey,
  NewsItem, NewsTag, NewsUrgency,
  Insight, InsightCategory, InsightScope, InsightStatus, InsightActionStep,
  Anomaly,
} from '@/types';
import { REGION_LABELS, CHANNEL_LABELS } from '@/types';

// ===== Seedable PRNG (Mulberry32) =====
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

function randBetween(min: number, max: number): number {
  return min + rng() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}

function gaussian(): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ===== Constants =====
const END_DATE = new Date('2026-02-11');
const DATA_DAYS = 180;
const START_DATE = subDays(END_DATE, DATA_DAYS - 1);
const ALL_REGIONS: RegionId[] = ['north-america'];
const ALL_CHANNELS: ChannelId[] = ['instagram', 'facebook', 'tiktok', 'google-search', 'ttd', 'ctv', 'spotify'];

// ===== Channel Profiles =====
interface ChannelProfile {
  baseSpend: number;
  cpmRange: [number, number];
  ctrRange: [number, number];
  cvrRange: [number, number];
  cpcRange: [number, number];
  videoViewRate: number;
  videoCompletionRate: number;
  engagementMultiplier: number;
  volatility: number;
}

const CHANNEL_PROFILES: Record<ChannelId, ChannelProfile> = {
  'google-search': { baseSpend: 2085, cpmRange: [15, 30], ctrRange: [4, 8], cvrRange: [6, 10], cpcRange: [2, 5], videoViewRate: 0, videoCompletionRate: 0, engagementMultiplier: 0.5, volatility: 0.15 },
  'facebook': { baseSpend: 1730, cpmRange: [8, 18], ctrRange: [1.2, 2.5], cvrRange: [2.5, 5], cpcRange: [0.8, 2.5], videoViewRate: 0.3, videoCompletionRate: 0.25, engagementMultiplier: 1.2, volatility: 0.12 },
  'instagram': { baseSpend: 1535, cpmRange: [8, 20], ctrRange: [1, 2.2], cvrRange: [2.5, 4.5], cpcRange: [1, 3], videoViewRate: 0.4, videoCompletionRate: 0.3, engagementMultiplier: 1.5, volatility: 0.1 },
  'tiktok': { baseSpend: 1185, cpmRange: [5, 15], ctrRange: [0.8, 2], cvrRange: [1.5, 3.5], cpcRange: [0.5, 2], videoViewRate: 0.8, videoCompletionRate: 0.15, engagementMultiplier: 2.0, volatility: 0.25 },
  'ttd': { baseSpend: 2570, cpmRange: [5, 15], ctrRange: [0.3, 1], cvrRange: [1, 2.5], cpcRange: [1, 4], videoViewRate: 0.2, videoCompletionRate: 0.2, engagementMultiplier: 0.3, volatility: 0.08 },
  'ctv': { baseSpend: 3200, cpmRange: [20, 40], ctrRange: [0.2, 0.6], cvrRange: [0.8, 2.0], cpcRange: [3, 8], videoViewRate: 0.9, videoCompletionRate: 0.7, engagementMultiplier: 0.2, volatility: 0.06 },
  'spotify': { baseSpend: 1400, cpmRange: [10, 25], ctrRange: [0.5, 1.5], cvrRange: [1.2, 3.0], cpcRange: [1.5, 4], videoViewRate: 0.0, videoCompletionRate: 0.0, engagementMultiplier: 0.4, volatility: 0.10 },
};

// ===== Region multipliers =====
const REGION_MULTIPLIERS: Record<RegionId, number> = {
  'north-america': 1.4,
};

// ===== Campaign definitions =====
interface CampaignDef {
  id: string; name: string; region: RegionId; objective: CampaignObjective;
  status: CampaignStatus; channels: ChannelId[]; budgetMultiplier: number;
  countries: string[]; plannedBudget: number;
}

const CAMPAIGN_DEFS: CampaignDef[] = [
  // ── Plum+ Loyalty Campaigns ──
  // Plum+ Membership Growth — drive new sign-ups and upgrades from free Plum to paid Plum+
  { id: 'ind-plum-growth', name: 'Plum+ Membership Growth', region: 'north-america', objective: 'performance', status: 'live',
    channels: ['google-search', 'facebook', 'instagram', 'ttd', 'spotify'], budgetMultiplier: 1.0136, plannedBudget: 1600000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB'] },
  // Plum+ Retention & Upsell — re-engage existing members, drive renewals and higher AOV
  { id: 'ind-plum-retain', name: 'Plum+ Retention & Upsell', region: 'north-america', objective: 'performance', status: 'live',
    channels: ['facebook', 'instagram', 'google-search'], budgetMultiplier: 0.8450, plannedBudget: 980000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL'] },

  // ── Persona-Based Campaigns ──
  // BookTok Readers — social-first discovery audience, 18-34, genre fiction and trending titles
  { id: 'ind-booktok-readers', name: 'BookTok Readers', region: 'north-america', objective: 'awareness', status: 'live',
    channels: ['tiktok', 'instagram', 'spotify'], budgetMultiplier: 1.2200, plannedBudget: 1100000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'NS'] },
  // Gift Givers & Seasonal Shoppers — high-intent gifting audience, seasonal moments
  { id: 'ind-gift-givers', name: 'Gift Givers & Seasonal Shoppers', region: 'north-america', objective: 'performance', status: 'live',
    channels: ['google-search', 'facebook', 'instagram', 'ttd', 'ctv'], budgetMultiplier: 1.4800, plannedBudget: 2200000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT'] },
  // Millennial Parents — 28-42, education, kids books, baby registry, IndigoKids
  { id: 'ind-millennial-parents', name: 'Millennial Parents', region: 'north-america', objective: 'consideration', status: 'live',
    channels: ['facebook', 'instagram', 'google-search'], budgetMultiplier: 1.1050, plannedBudget: 1050000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB'] },
  // Cozy Lifestyle Enthusiasts — home décor, candles, journals, Love & Lore, Nota
  { id: 'ind-cozy-lifestyle', name: 'Cozy Lifestyle Enthusiasts', region: 'north-america', objective: 'consideration', status: 'live',
    channels: ['instagram', 'tiktok', 'facebook', 'ctv'], budgetMultiplier: 1.1500, plannedBudget: 980000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'NS'] },

  // ── Core Retail Campaigns ──
  // Holiday Gift Guide — peak seasonal push across all provinces
  { id: 'ind-holiday-gift', name: 'Holiday Gift Guide', region: 'north-america', objective: 'performance', status: 'live',
    channels: ['instagram', 'facebook', 'tiktok', 'google-search', 'ttd', 'ctv', 'spotify'], budgetMultiplier: 1.6116, plannedBudget: 3720000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT'] },
  // Bestseller Awareness — new releases and bestseller lists
  { id: 'ind-bestseller', name: 'Bestseller Awareness', region: 'north-america', objective: 'awareness', status: 'live',
    channels: ['instagram', 'facebook', 'ttd', 'ctv', 'spotify'], budgetMultiplier: 0.6286, plannedBudget: 1400000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE'] },
  // Private Label Push — Love & Lore, Nota, OUI Studio
  { id: 'ind-private-label', name: 'Private Label Push', region: 'north-america', objective: 'consideration', status: 'live',
    channels: ['instagram', 'tiktok', 'facebook'], budgetMultiplier: 1.349, plannedBudget: 1400000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'NS'] },
  // E-Commerce Retargeting — Indigo.ca conversion
  { id: 'ind-ecom-retarget', name: 'E-Commerce Retargeting', region: 'north-america', objective: 'performance', status: 'live',
    channels: ['google-search', 'ttd', 'facebook'], budgetMultiplier: 0.5231, plannedBudget: 930000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE'] },
];

// ===== Events (anomaly generators) =====
interface DataEvent {
  name: string; dayOffset: number; duration: number;
  regions: RegionId[]; spendMult: number; cvrMult: number; engageMult: number;
}

const DATA_EVENTS: DataEvent[] = [
  { name: 'Spring Campaign Launch', dayOffset: 45, duration: 7, regions: ['north-america'], spendMult: 1.8, cvrMult: 1.3, engageMult: 2.0 },
  { name: 'Amazon Prime Day Competition', dayOffset: 90, duration: 10, regions: ['north-america'], spendMult: 1.0, cvrMult: 0.8, engageMult: 0.7 },
  { name: 'Giller Prize Season Buzz', dayOffset: 70, duration: 14, regions: ALL_REGIONS, spendMult: 1.3, cvrMult: 1.15, engageMult: 1.4 },
  { name: 'TikTok Algorithm Shift', dayOffset: 100, duration: 5, regions: ALL_REGIONS, spendMult: 1.0, cvrMult: 0.75, engageMult: 1.6 },
  { name: 'Holiday Season Push', dayOffset: 150, duration: 10, regions: ['north-america'], spendMult: 1.5, cvrMult: 1.1, engageMult: 1.1 },
];

// ===== Data Generation =====
function generateDailyData(): Record<string, Record<string, DailyMetrics[]>> {
  const data: Record<string, Record<string, DailyMetrics[]>> = {};

  for (const campaign of CAMPAIGN_DEFS) {
    data[campaign.id] = {};
    const regionMult = REGION_MULTIPLIERS[campaign.region];

    for (const channel of campaign.channels) {
      const profile = CHANNEL_PROFILES[channel];
      const days: DailyMetrics[] = [];

      for (let d = 0; d < DATA_DAYS; d++) {
        const date = format(subDays(END_DATE, DATA_DAYS - 1 - d), 'yyyy-MM-dd');
        const dayOfWeek = new Date(date).getDay();
        const weekendMult = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.75 : 1.0;
        const seasonality = 1 + 0.1 * Math.sin((d / DATA_DAYS) * Math.PI * 2);

        // Check events
        let eventSpendMult = 1, eventCvrMult = 1, eventEngageMult = 1;
        for (const evt of DATA_EVENTS) {
          if (d >= evt.dayOffset && d < evt.dayOffset + evt.duration && evt.regions.includes(campaign.region)) {
            eventSpendMult *= evt.spendMult;
            eventCvrMult *= evt.cvrMult;
            eventEngageMult *= evt.engageMult;
          }
        }

        const noise = 1 + gaussian() * profile.volatility;
        const spendBase = profile.baseSpend * campaign.budgetMultiplier * regionMult * weekendMult * seasonality * eventSpendMult * Math.max(0.3, noise);
        const spend = Math.max(10, spendBase);

        const cpm = randBetween(profile.cpmRange[0], profile.cpmRange[1]) * (1 + gaussian() * 0.1);
        const impressions = Math.round((spend / cpm) * 1000);
        const reach = Math.round(impressions * randBetween(0.6, 0.85));

        const ctr = randBetween(profile.ctrRange[0], profile.ctrRange[1]) * Math.max(0.5, 1 + gaussian() * 0.15) / 100;
        const clicks = Math.round(impressions * ctr);

        const lpvRate = randBetween(0.5, 0.8);
        const landingPageViews = Math.round(clicks * lpvRate);

        const cvr = randBetween(profile.cvrRange[0], profile.cvrRange[1]) * eventCvrMult * Math.max(0.3, 1 + gaussian() * 0.15) / 100;
        const conversions = Math.max(0, Math.round(clicks * cvr));
        const leads = Math.round(conversions * randBetween(1.5, 3));

        const avgOrderValue = randBetween(190, 440);
        const revenue = conversions * avgOrderValue * randBetween(0.8, 1.2);

        const videoViews3s = Math.round(impressions * profile.videoViewRate * randBetween(0.8, 1.2));
        const videoViewsThruplay = Math.round(videoViews3s * profile.videoCompletionRate * randBetween(0.7, 1.3));

        const engagements = Math.round(impressions * profile.engagementMultiplier * eventEngageMult * randBetween(0.01, 0.04));
        const assistedConversions = Math.round(conversions * randBetween(0.2, 0.5));

        days.push({
          date, spend, impressions, reach, clicks, landingPageViews,
          leads, conversions, revenue, videoViews3s, videoViewsThruplay,
          engagements, assistedConversions,
        });
      }
      data[campaign.id][channel] = days;
    }
  }
  return data;
}

// ===== Aggregation =====
export function aggregateMetrics(dailyData: DailyMetrics[]): AggregatedKPIs {
  if (dailyData.length === 0) {
    return {
      date: '', spend: 0, impressions: 0, reach: 0, clicks: 0, landingPageViews: 0,
      leads: 0, conversions: 0, revenue: 0, videoViews3s: 0, videoViewsThruplay: 0,
      engagements: 0, assistedConversions: 0,
      frequency: 0, ctr: 0, cpc: 0, cpm: 0, lpvRate: 0, cpl: 0, cpa: 0, roas: 0,
      videoCompletionRate: 0, threeSecondViewRate: 0, engagementRate: 0, brandSearchLift: 0, shareOfVoice: 0,
      volatilityScore: 0, anomalyCount: 0, budgetPacing: 0, creativeFatigueIndex: 0,
    };
  }

  const sum = (key: keyof DailyMetrics) => dailyData.reduce((s, d) => s + (d[key] as number), 0);

  const spend = sum('spend');
  const impressions = sum('impressions');
  const reach = sum('reach');
  const clicks = sum('clicks');
  const landingPageViews = sum('landingPageViews');
  const leads = sum('leads');
  const conversions = sum('conversions');
  const revenue = sum('revenue');
  const videoViews3s = sum('videoViews3s');
  const videoViewsThruplay = sum('videoViewsThruplay');
  const engagements = sum('engagements');
  const assistedConversions = sum('assistedConversions');

  const frequency = reach > 0 ? impressions / reach : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const lpvRate = clicks > 0 ? (landingPageViews / clicks) * 100 : 0;
  const cpl = leads > 0 ? spend / leads : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  const roas = spend > 0 ? revenue / spend : 0;
  const videoCompletionRate = videoViews3s > 0 ? (videoViewsThruplay / videoViews3s) * 100 : 0;
  const threeSecondViewRate = impressions > 0 ? (videoViews3s / impressions) * 100 : 0;
  const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

  // Mock health indicators
  const spendValues = dailyData.map(d => d.spend);
  const mean = spendValues.reduce((a, b) => a + b, 0) / spendValues.length;
  const stdDev = Math.sqrt(spendValues.reduce((s, v) => s + (v - mean) ** 2, 0) / spendValues.length);
  const volatilityScore = mean > 0 ? (stdDev / mean) * 100 : 0;

  // Count anomalies in last 7 days
  const last7 = dailyData.slice(-7);
  let anomalyCount = 0;
  for (const day of last7) {
    const zScore = mean > 0 ? Math.abs(day.spend - mean) / (stdDev || 1) : 0;
    if (zScore > 2) anomalyCount++;
  }

  const brandSearchLift = 50 + rng() * 50;
  const shareOfVoice = 10 + rng() * 30;
  const budgetPacing = 82 + rng() * 13;
  const creativeFatigueIndex = 20 + rng() * 60;

  return {
    date: dailyData[dailyData.length - 1]?.date ?? '',
    spend, impressions, reach, clicks, landingPageViews, leads, conversions, revenue,
    videoViews3s, videoViewsThruplay, engagements, assistedConversions,
    frequency, ctr, cpc, cpm, lpvRate, cpl, cpa, roas,
    videoCompletionRate, threeSecondViewRate, engagementRate, brandSearchLift, shareOfVoice,
    volatilityScore, anomalyCount, budgetPacing, creativeFatigueIndex,
  };
}

export function computeDeltas(current: AggregatedKPIs, previous: AggregatedKPIs): Record<KPIKey, KPIDelta> {
  const result: Record<string, KPIDelta> = {};
  const keys: KPIKey[] = [
    'spend', 'impressions', 'reach', 'clicks', 'landingPageViews', 'leads', 'conversions', 'revenue',
    'videoViews3s', 'videoViewsThruplay', 'engagements', 'assistedConversions',
    'frequency', 'ctr', 'cpc', 'cpm', 'lpvRate', 'cpl', 'cpa', 'roas',
    'videoCompletionRate', 'threeSecondViewRate', 'engagementRate', 'brandSearchLift', 'shareOfVoice',
    'volatilityScore', 'anomalyCount', 'budgetPacing', 'creativeFatigueIndex',
  ];
  for (const key of keys) {
    const v = current[key] as number;
    const pv = previous[key] as number;
    result[key] = {
      value: v, previousValue: pv,
      delta: v - pv,
      deltaPercent: pv !== 0 ? ((v - pv) / pv) * 100 : 0,
    };
  }
  return result as Record<KPIKey, KPIDelta>;
}

// ===== Anomaly Detection =====
function detectAnomalies(dailyData: Record<string, Record<string, DailyMetrics[]>>): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const metricsToCheck: (keyof DailyMetrics)[] = ['spend', 'clicks', 'conversions', 'revenue'];

  for (const campaignDef of CAMPAIGN_DEFS) {
    for (const channel of campaignDef.channels) {
      const series = dailyData[campaignDef.id]?.[channel];
      if (!series || series.length < 30) continue;

      for (const metric of metricsToCheck) {
        const values = series.map(d => d[metric] as number);
        const rollingWindow = 30;

        for (let i = rollingWindow; i < values.length; i++) {
          const window = values.slice(i - rollingWindow, i);
          const windowMean = window.reduce((a, b) => a + b, 0) / window.length;
          const windowStd = Math.sqrt(window.reduce((s, v) => s + (v - windowMean) ** 2, 0) / window.length);

          if (windowStd === 0) continue;
          const zScore = Math.abs(values[i] - windowMean) / windowStd;

          if (zScore > 2.5) {
            const severity = zScore > 3.5 ? 'high' : zScore > 3 ? 'medium' : 'low';
            anomalies.push({
              id: `anom-${campaignDef.id}-${channel}-${metric}-${i}`,
              date: series[i].date,
              region: campaignDef.region,
              campaign: campaignDef.id,
              channel: channel,
              metric: metric as KPIKey,
              severity,
              zScore: Math.round(zScore * 100) / 100,
              description: `${metric} ${values[i] > windowMean ? 'spike' : 'drop'} in ${campaignDef.name} (${CHANNEL_LABELS[channel]}): z-score ${zScore.toFixed(1)}`,
            });
          }
        }
      }
    }
  }

  // Limit and sort by date desc
  return anomalies.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200);
}

// ===== News Generation =====
const NEWS_SOURCES_BY_TAG: Record<string, string[]> = {
  brand: ['Retail Insider', 'Financial Post', 'Strategy Online', 'The Globe and Mail', 'Marketing Magazine', 'CBC News'],
  publishing: ['Publishers Weekly', 'BookNet Canada', 'Canadian Bookseller', 'The Globe and Mail', 'Quill & Quire'],
  genre: ['BookNet Canada', 'Publishers Weekly', 'Goodreads', 'Amazon.ca Bestsellers', 'Library Journal'],
  amazon: ['Amazon.ca Bestsellers', 'Amazon.ca Category Data', 'Amazon.ca New Releases', 'Jungle Scout'],
  social: ['Reddit r/books', 'Reddit r/suggestmeabook', 'Reddit r/CanLit', 'Reddit r/RomanceBooks', 'Reddit r/bookshelf'],
  gifting: ['Retail Insider', 'Trend Hunter', 'Pinterest Trends', 'Shopify Canada', 'Financial Post'],
  macro: ['Statistics Canada', 'The Globe and Mail', 'Financial Post', 'Deloitte Canada', 'CBC News'],
};

function generateNews(): NewsItem[] {
  const items: NewsItem[] = [];
  const templates: Array<{
    titleTemplate: (c?: string) => string; tags: NewsTag[]; urgency: NewsUrgency;
    summary: string; whyItMatters: string; competitor?: string;
  }> = [
    // ── 1. Brand & Corporate Narrative (3 pinned) ──
    { titleTemplate: () => 'Indigo Mentions Surge After CEO Interview on Canadian Cultural Retail Vision', tags: ['brand'], urgency: 'high', summary: 'Indigo CEO\'s interview on BNN Bloomberg discussing the "cultural department store" strategy generated significant media pickup and social conversation, with brand mentions up 280% in 48 hours. Coverage framed Indigo as a differentiated Canadian retailer rather than a bookstore under pressure.', whyItMatters: 'The narrative is shifting toward strategic relevance and cultural positioning — this is the story Indigo wants the market to tell. Amplify before the news cycle moves on.' },
    { titleTemplate: () => 'Plum+ Pricing Narrative Shifts as Membership Passes 1.2M — Value Perception Rising', tags: ['brand'], urgency: 'high', summary: 'Indigo\'s Plum+ paid membership has surpassed 1.2M subscribers. Media coverage has shifted from questioning the pricing model to framing it as a loyalty success story, with analysts noting the 3.4x higher AOV among members.', whyItMatters: 'The loyalty narrative is now working in Indigo\'s favour — membership is being framed as value, not cost. This supports premium positioning across all customer-facing communications.' },
    { titleTemplate: () => 'Indigo ESG Report Highlights Nota Brand\'s Sustainable Sourcing — Mixed Reception', tags: ['brand'], urgency: 'medium', summary: 'Indigo\'s latest ESG report highlights sustainable sourcing for the Nota brand and packaging reduction initiatives. Reception is mixed: sustainability advocates praise the direction while critics question the pace relative to peers.', whyItMatters: 'ESG narrative requires careful management — positive signals exist but the story isn\'t fully landed. Monitor sentiment and consider proactive communication to control the framing.' },

    // ── 2. Book Industry & Publishing Shifts (3 pinned) ──
    { titleTemplate: () => 'Canadian Publishing Revenue Hits $1.7B — Digital Formats and Social Discovery Drive Growth', tags: ['publishing'], urgency: 'high', summary: 'StatCan reports Canadian publishing industry revenue rose to $1.7B in 2024, with continued growth from digital reading formats and social media-driven discovery. Physical book sales remain strong but audiobook and eBook adoption is accelerating, particularly among 18-34 readers.', whyItMatters: 'The Canadian book market is growing and diversifying. Indigo must track where the growth is coming from — physical vs. digital, discovery-driven vs. backlist — to ensure assortment and merchandising stay aligned with actual demand patterns.' },
    { titleTemplate: () => 'Audiobook Sales in Canada Grow 23% YoY — Subscription Models Gaining Ground', tags: ['publishing'], urgency: 'medium', summary: 'Canadian audiobook sales grew 23% year-over-year, with subscription platforms like Audible and Libro.fm driving adoption. BookNet Canada notes that 31% of audiobook listeners also buy physical copies of the same titles, suggesting format complementarity rather than cannibalization.', whyItMatters: 'Audiobook growth represents both opportunity and risk for Indigo. Format complementarity is encouraging, but if subscription platforms capture the discovery moment, Indigo\'s role in the purchase journey could diminish.' },
    { titleTemplate: () => 'Canadian Publishers Report Backlist Resurgence — Adaptation-Driven Demand Spikes Across Catalogues', tags: ['publishing'], urgency: 'medium', summary: 'Multiple Canadian publishers report surging backlist sales driven by film/TV adaptations, BookTok rediscovery, and award-cycle momentum. Titles 3-10 years old are seeing 40-60% sales increases when triggered by cultural moments.', whyItMatters: 'Backlist resurgence is predictable and actionable — Indigo should build merchandising playbooks around known adaptation schedules and social rediscovery patterns to capture demand before it peaks.' },

    // ── 3. Genre & Title Momentum (3 pinned) ──
    { titleTemplate: () => 'Horror and Dark Fiction Surge — BookNet Canada Flags Genre as Fastest-Growing Category', tags: ['genre'], urgency: 'high', summary: 'BookNet Canada\'s latest genre report shows horror and dark fiction as the fastest-growing book category in Canada, with unit sales up 34% year-over-year. The surge is driven by BookTok horror recommendations, seasonal reading trends, and crossover appeal from thriller readers.', whyItMatters: 'Horror is accelerating faster than most retailers have adjusted for. Indigo should evaluate shelf allocation, online merchandising, and marketing creative to capture this momentum while it\'s still building.' },
    { titleTemplate: () => 'Romantasy Continues to Dominate — Fourth Wing Sequel Pre-Orders Break Indigo Records', tags: ['genre'], urgency: 'high', summary: 'The romantasy genre continues its dominance, with the next Fourth Wing sequel pre-orders setting records at Indigo and across Canadian retailers. Sarah J. Maas, Rebecca Yarros, and Holly Black remain the genre\'s anchors, while breakout authors are emerging rapidly from BookTok.', whyItMatters: 'Romantasy is not a trend — it\'s a category shift. Indigo should treat it as a permanent merchandising pillar with dedicated shelf space, curated collections, and sustained marketing investment.' },
    { titleTemplate: () => 'r/booktalk Buzzing Over Debut Novel "The Returning Tide" — Thread Hits 4.2K Upvotes in 48 Hours', tags: ['genre'], urgency: 'high', summary: 'A recommendation thread for debut Canadian author Maren Calloway\'s "The Returning Tide" has exploded on r/booktalk, hitting 4.2K upvotes and 800+ comments in 48 hours. Readers describe it as "literary fiction meets magical realism set on the BC coast" with comparisons to Miriam Toews and Eden Robinson. Multiple commenters report driving to Indigo to find it after seeing the thread.', whyItMatters: 'Reddit-driven breakout signals are early and high-conviction — when a thread hits this velocity, mainstream demand follows within 2-4 weeks. Indigo should verify inventory depth on "The Returning Tide," consider featuring it in Staff Picks or Heather\'s Picks, and align social content to the conversation already happening.' },

    // ── 4. Amazon Bestseller & Assortment Intelligence (3 pinned) ──
    { titleTemplate: () => 'Amazon.ca Bestsellers: Romance and Romantasy Hold 11 of Top 20 Spots for Third Consecutive Month', tags: ['amazon'], urgency: 'high', summary: 'Amazon.ca\'s bestseller list remains dominated by romance and romantasy titles, with 11 of the top 20 spots held by the genre. Fourth Wing, Iron Flame, and new entries from Sarah J. Maas and Ali Hazelwood are driving volume. Review velocity on breakout titles suggests sustained demand.', whyItMatters: 'Amazon\'s bestseller list is a real-time demand signal. When a genre holds this concentration for three consecutive months, it confirms category-level demand that Indigo should match in inventory depth and marketing allocation.' },
    { titleTemplate: () => 'Amazon.ca New Releases Climbing Fast — Self-Help and "Slow Living" Titles Breaking Through', tags: ['amazon'], urgency: 'medium', summary: 'Amazon.ca\'s "Hot New Releases" list shows rapid climbing by self-help and "slow living" titles, including books on digital detox, intentional routines, and mindful consumption. Several have moved from outside the top 100 to the top 20 within two weeks.', whyItMatters: 'Titles climbing quickly on Amazon signal emerging demand before it peaks. Indigo can use these signals to position early and capture the demand curve while Amazon competes on price and convenience.' },
    { titleTemplate: () => 'Amazon.ca BookTok Bestseller List Diverges from Main List — Signals Distinct Demand Pattern', tags: ['amazon'], urgency: 'high', summary: 'Amazon.ca\'s BookTok-specific bestseller list now diverges meaningfully from the main bestseller list, with different titles, genres, and velocity patterns. BookTok bestsellers skew younger, more genre-diverse, and more influenced by trope-based discovery than traditional review-driven purchasing.', whyItMatters: 'The divergence confirms that BookTok-driven demand is a distinct market segment with its own discovery and purchase behaviour. Indigo should track both lists separately and merchandise accordingly.' },

    // ── 5. Social & Cultural Book Conversation (3 pinned) ──
    { titleTemplate: () => 'r/books "What Are You Reading?" Weekly Thread Surfaces 3 Breakout Titles — Canadian Authors Overrepresented', tags: ['social'], urgency: 'high', summary: 'The r/books weekly "What Are You Reading?" thread has surfaced three titles gaining rapid momentum, two by Canadian authors. Comments mentioning these titles have 4x the average engagement, and multiple users report purchasing after seeing the thread. The pattern mirrors previous Reddit-driven breakouts that later hit mainstream bestseller lists.', whyItMatters: 'Reddit reading threads are high-signal discovery channels — engaged readers sharing genuine recommendations carry more purchase conviction than algorithmic feeds. Indigo should monitor these weekly threads as early demand indicators and cross-reference with inventory and merchandising.' },
    { titleTemplate: () => 'r/suggestmeabook "Dark Academia" Requests Up 280% — Cross-Category Purchasing Signal Strengthening', tags: ['social'], urgency: 'medium', summary: 'The r/suggestmeabook community is seeing a 280% increase in "dark academia" recommendation requests, with readers seeking not just books but associated stationery, candles, journals, and home décor. Thread discussions frequently mention Indigo as a destination for building the full aesthetic.', whyItMatters: 'Aesthetic-driven purchasing is a merchandising opportunity that spans Indigo\'s entire assortment — books, Nota stationery, candles, and lifestyle. Curating around aesthetic themes rather than just categories could unlock cross-sell potential.' },
    { titleTemplate: () => 'r/CanLit Community Drives Pre-Order Surge for Giller Prize Longlist — Correlation Strengthening', tags: ['social'], urgency: 'medium', summary: 'The r/CanLit subreddit\'s discussion threads around the Giller Prize longlist are increasingly correlated with pre-order surges at Canadian retailers. Titles featured in top r/CanLit threads see 3-5x higher pre-order rates than comparable titles, with the effect strongest in literary fiction and Canadian-authored works.', whyItMatters: 'Reddit literary communities surface demand signals that are higher-conviction than algorithmic recommendations. Indigo should monitor r/CanLit systematically and use discussion velocity to inform pre-order marketing, inventory allocation, and Staff Picks curation.' },

    // ── 6. Gifting, Lifestyle & Home Trends (3 pinned) ──
    { titleTemplate: () => 'Emotional-Value Gifting Rises as Canadians Pull Back on Discretionary Spending', tags: ['gifting'], urgency: 'high', summary: 'Retail research shows Canadian consumers are shifting toward "emotional-value" gifts — thoughtful, curated items that feel personal rather than expensive. Books, journals, candles, and curated gift sets are outperforming generic luxury gifts, with 67% of consumers saying they prefer "meaningful over expensive."', whyItMatters: 'Indigo\'s entire assortment — from curated book selections to Love & Lore accessories to Nota stationery — is perfectly positioned for the emotional-value gifting trend. This should be the core narrative for all gift-season marketing.' },
    { titleTemplate: () => 'Mother\'s Day Gift Search Volume Up 38% — "Books for Mom" and "Self-Care Gifts" Leading', tags: ['gifting'], urgency: 'high', summary: 'Google Trends and Pinterest data show Mother\'s Day gift search volume is up 38% year-over-year in Canada, with "books for mom," "self-care gift sets," and "journal gift" among the fastest-growing queries. Search intent is shifting earlier, with peak research starting 3 weeks before the holiday.', whyItMatters: 'Mother\'s Day is a high-intent gifting moment that aligns directly with Indigo\'s strengths. Campaign timing should start earlier this year to match the shifted search curve, with creative featuring curated gift sets and book-lover bundles.' },
    { titleTemplate: () => 'Cozy Living and "Dopamine Décor" Trends Drive Home Category Growth Across Canadian Retail', tags: ['gifting'], urgency: 'medium', summary: 'Pinterest and Trend Hunter report that "cozy living" and "dopamine décor" — bright, mood-boosting home accessories — are the two dominant home trend aesthetics heading into spring/summer 2026. Candles, throw blankets, desk accessories, and reading nooks remain core to the cozy trend.', whyItMatters: 'These lifestyle aesthetics directly overlap with Indigo\'s home and lifestyle assortment. Merchandising and marketing should explicitly use the trending language — "cozy," "dopamine décor," "reading nook" — to connect with what consumers are already searching for.' },

    // ── 7. Macro Consumer & Retail Environment (3 pinned) ──
    { titleTemplate: () => 'Canadian Consumer Confidence Dips in Q1 2026 — Discretionary Spending Under Pressure', tags: ['macro'], urgency: 'high', summary: 'The Conference Board of Canada reports consumer confidence declined in Q1 2026, with 62% of Canadians reporting they plan to reduce discretionary spending over the next 6 months. Specialty retail and non-essential categories face the most pressure, while value-oriented and experience-driven retailers show relative resilience.', whyItMatters: 'A cautious spending environment means Indigo must emphasize value, emotional resonance, and the unique in-store experience in all communications. Volume-driven strategies will underperform; curated, intentional positioning wins.' },
    { titleTemplate: () => 'E-Commerce Share of Canadian Retail Reaches 14.2% — Omnichannel Retailers Outperform', tags: ['macro'], urgency: 'medium', summary: 'Statistics Canada reports e-commerce now represents 14.2% of total retail sales, up from 12.8% a year ago. Retailers with strong omnichannel capabilities — seamless online-to-store, BOPIS, and unified loyalty — are growing 2.3x faster than pure-play e-commerce or brick-and-mortar-only competitors.', whyItMatters: 'Omnichannel is no longer optional — it\'s the growth driver. Indigo\'s investment in Indigo.ca, in-store pickup, and Plum+ integration positions it well, but execution must keep pace with rising consumer expectations for seamlessness.' },
    { titleTemplate: () => 'Canadian Mall Foot Traffic Stabilizes But Shifts to Experience-Led Retailers', tags: ['macro'], urgency: 'medium', summary: 'Mall foot traffic data shows overall visits have stabilized after two years of decline, but traffic is redistributing toward experience-led and destination retailers. Book and lifestyle retailers are among the beneficiaries, while commodity-focused tenants continue to lose share of visits.', whyItMatters: 'Foot traffic stabilization with a shift toward experience-led retail is a positive signal for Indigo\'s store model. The "cultural department store" positioning is exactly the kind of destination retail that is capturing redirected foot traffic.' },

    // ── Loop articles (recycled across dates) ──
    // Brand loop
    { titleTemplate: () => 'Indigo Brand Sentiment Turns Positive on Social After Heather\'s Picks Viral Moment', tags: ['brand'], urgency: 'medium', summary: 'A Heather\'s Picks recommendation went viral on BookTok, generating 1.2M views and shifting brand sentiment measurably positive across social platforms. The organic moment reinforced Indigo\'s curation credibility with younger audiences.', whyItMatters: 'Viral curation moments are high-value brand signals — they validate Indigo\'s positioning and generate organic reach that paid media should amplify before the moment fades.' },
    { titleTemplate: () => 'Indigo Opens Three New Small-Format Stores in Suburban Ontario Markets', tags: ['brand'], urgency: 'medium', summary: 'Indigo has opened three new small-format stores in suburban Ontario communities, featuring a curated book selection, lifestyle products, and community event space. The format targets underserved markets with strong local demand for curated retail.', whyItMatters: 'New store openings signal confidence in the physical retail model and extend Indigo\'s reach. Each opening is an opportunity to generate local media coverage and geo-targeted marketing to build awareness in new markets.' },
    { titleTemplate: () => 'Indigo Partners with Canadian Author for Exclusive Limited Edition — Sells Out in 48 Hours', tags: ['brand'], urgency: 'high', summary: 'Indigo\'s exclusive limited-edition partnership with a bestselling Canadian author sold out online and in stores within 48 hours. The partnership included exclusive cover art, signed copies, and a curated reading list, generating significant social buzz and media coverage.', whyItMatters: 'Exclusive partnerships reinforce Indigo\'s curation advantage and create urgency-driven purchase moments that competitors cannot replicate. The sell-through velocity validates the strategy.' },

    // Publishing loop
    { titleTemplate: () => 'Canadian Independent Publishers Report 22% Revenue Growth — Genre Fiction Leads', tags: ['publishing'], urgency: 'medium', summary: 'Canadian independent publishers report 22% revenue growth driven by genre fiction, including romance, horror, and speculative fiction. The growth is attributed to social media discovery, BookTok amplification, and renewed reader interest in diverse voices.', whyItMatters: 'Independent publisher growth expands the pool of titles Indigo can curate. Strong genre fiction performance from indie publishers could feed Indigo\'s "Discover" merchandising and differentiate from Amazon\'s algorithm-driven recommendations.' },
    { titleTemplate: () => 'eBook Sales Flatten While Physical Books Continue to Grow — Format Shift Stabilizing', tags: ['publishing'], urgency: 'low', summary: 'Industry data shows eBook sales have flattened year-over-year while physical book sales continue to grow at 4-6% annually. The format shift appears to be stabilizing, with audiobooks as the primary digital growth driver rather than eBooks.', whyItMatters: 'Physical book resilience is positive for Indigo\'s core business model. The real digital disruption is audiobooks, not eBooks — Indigo should monitor audiobook platform partnerships rather than worrying about eBook cannibalization.' },
    { titleTemplate: () => 'BookNet Canada Reports Children\'s Publishing as Fastest-Growing Segment for Third Year', tags: ['publishing'], urgency: 'medium', summary: 'BookNet Canada reports children\'s publishing remains the fastest-growing segment for the third consecutive year, with unit sales up 12% and revenue up 15%. Activity books, early readers, and middle-grade fiction are driving the growth.', whyItMatters: 'Sustained children\'s publishing growth reinforces IndigoKids as a strategic priority. Indigo should ensure its children\'s assortment depth and merchandising reflect the segment\'s importance to the overall market.' },

    // Genre loop
    { titleTemplate: () => 'Cozy Mystery and "Comfort Reading" Subgenre Emerges as BookTok-Driven Category', tags: ['genre'], urgency: 'medium', summary: 'A new "cozy mystery" and "comfort reading" subgenre is emerging rapidly on BookTok, characterized by low-stakes mysteries, small-town settings, and comforting narratives. The subgenre is attracting readers who want escapism without intensity, and titles are climbing bestseller lists.', whyItMatters: 'Emerging subgenres caught early give Indigo a curation advantage. Cozy mystery aligns perfectly with the "cozy living" lifestyle trend — an opportunity for cross-category merchandising linking books, candles, and reading accessories.' },
    { titleTemplate: () => 'Literary Fiction Sees Unexpected Resurgence — Award Season and BookTok Converge', tags: ['genre'], urgency: 'medium', summary: 'Literary fiction is experiencing an unexpected resurgence, driven by the convergence of award-season buzz and BookTok literary communities. Titles from the Booker and Giller Prize longlists are seeing sustained sales momentum well beyond the typical award-cycle window.', whyItMatters: 'Literary fiction resurgence is good for Indigo\'s brand positioning — it reinforces the curation and cultural credibility that differentiates Indigo from mass-market competitors. Feature award-winning titles prominently in merchandising and marketing.' },
    { titleTemplate: () => 'Thriller Genre Fragments — "Domestic Noir" and "Psychological Suspense" Split Into Distinct Categories', tags: ['genre'], urgency: 'low', summary: 'The thriller genre is fragmenting, with "domestic noir" and "psychological suspense" emerging as distinct subgenres with different reader profiles, discovery patterns, and purchase behaviour. BookNet data shows readers increasingly self-identify with specific subgenres rather than the broad "thriller" label.', whyItMatters: 'Genre fragmentation creates merchandising complexity but also opportunity. Indigo can use subgenre-specific curation to serve reader preferences more precisely than competitors who still merchandise by broad category.' },

    // Amazon loop
    { titleTemplate: () => 'Amazon.ca Gift Bundle Sales Surge 52% — Curated Book + Lifestyle Sets Leading', tags: ['amazon'], urgency: 'high', summary: 'Amazon.ca reports gift bundle sales are up 52% year-over-year, with curated "book + lifestyle" bundles (book + candle, book + journal, book + mug) among the fastest-growing product types. Review data shows gifting intent drives 78% of bundle purchases.', whyItMatters: 'Amazon proving demand for book + lifestyle bundles validates Indigo\'s cross-category merchandising strategy. Indigo can differentiate by offering higher-quality, private-label bundle components (Love & Lore, Nota) that Amazon can\'t match.' },
    { titleTemplate: () => 'Amazon.ca Review Velocity Spikes on Three Debut Authors — Breakout Signals Emerging', tags: ['amazon'], urgency: 'medium', summary: 'Three debut authors have shown rapid review accumulation on Amazon.ca over the past two weeks, with review counts growing 5-8x faster than comparable new releases. The pattern typically precedes mainstream breakout by 4-6 weeks.', whyItMatters: 'Review velocity on Amazon is one of the strongest leading indicators of breakout demand. Indigo should flag these authors for early merchandising consideration and marketing alignment before the mainstream wave hits.' },
    { titleTemplate: () => 'Amazon.ca Children\'s Category Sees 38% Unit Surge — STEM and Activity Books Lead', tags: ['amazon'], urgency: 'medium', summary: 'Amazon.ca children\'s book data shows a 38% unit sales surge, with STEM-themed books, activity books, and early readers leading growth. Parent reviewers consistently cite "educational but fun" as the purchase driver.', whyItMatters: 'Children\'s book demand on Amazon confirms the category momentum BookNet Canada is also reporting. Indigo should ensure IndigoKids inventory depth matches the demand signal, particularly in STEM and activity books.' },

    // Social loop
    { titleTemplate: () => 'r/bookshelf "Reading Nook" Posts Drive Cross-Category Purchasing — Books, Décor, and Accessories', tags: ['social'], urgency: 'medium', summary: 'The r/bookshelf community\'s popular "reading nook" and "shelfie" posts are driving cross-category purchasing, with readers buying not just books but candles, bookmarks, reading accessories, and cozy home items to recreate featured setups. Multiple posts reference Indigo as the go-to destination for building the full look.', whyItMatters: 'The "reading as lifestyle" trend is exactly Indigo\'s brand positioning. Marketing should lean into the identity angle — Indigo isn\'t just where you buy books, it\'s where you build your reading life. Cross-category merchandising should follow.' },
    { titleTemplate: () => 'r/CanadianBookClub Grows to 180K Members — Indie and Literary Titles Overindex', tags: ['social'], urgency: 'low', summary: 'Reddit\'s r/CanadianBookClub community has grown to 180K members, with discussion heavily skewed toward independent publishers, literary fiction, and Canadian authors. The community\'s recommendations increasingly influence purchase decisions among engaged readers.', whyItMatters: 'Reddit book communities surface high-conviction demand signals — more literary, more indie, more Canadian-author focused. Indigo\'s curation advantage is strongest with exactly this audience. Monitor for merchandising signals.' },
    { titleTemplate: () => 'r/RomanceBooks "Enemies-to-Lovers" Mega-Thread Drives 340% Spike in Tagged Titles on Goodreads', tags: ['social'], urgency: 'medium', summary: 'A viral mega-thread on r/RomanceBooks requesting "enemies-to-lovers" recommendations has driven a 340% spike in Goodreads "want to read" additions for tagged titles. The trope-driven discovery pattern on Reddit continues to reshape how readers find and select books, with threads regularly surfacing 50+ title recommendations.', whyItMatters: 'Trope-driven discovery is becoming a primary navigation pattern for younger readers. Indigo should consider trope-based merchandising — in-store and online — alongside traditional genre and bestseller categories.' },

    // Gifting loop
    { titleTemplate: () => 'Teacher Appreciation and Graduation Gift Searches Begin Earlier Than Ever — Indigo Category Opportunity', tags: ['gifting'], urgency: 'medium', summary: 'Google Trends data shows teacher appreciation and graduation gift searches are starting 4 weeks earlier than last year, with "book gift for teacher," "graduation journal," and "personalized stationery" among the fastest-growing queries.', whyItMatters: 'Earlier search intent means earlier marketing activation. Indigo should launch teacher appreciation and graduation gift campaigns now rather than waiting for the traditional window — the demand curve has shifted.' },
    { titleTemplate: () => 'Personalization Trend Drives 28% Premium on Gifting Products — Journals and Stationery Lead', tags: ['gifting'], urgency: 'medium', summary: 'Retail data shows consumers are willing to pay a 28% premium for personalized gift items, with journals, stationery, and book accessories leading the personalization trend. Monogramming, custom covers, and curated sets are the most requested personalization types.', whyItMatters: 'Personalization commands a premium that aligns with Indigo\'s margin strategy. If Indigo can offer personalization on Nota stationery or Love & Lore accessories, it creates a defensible competitive advantage in the gifting category.' },
    { titleTemplate: () => 'Baby Gifting Market Grows 24% in Canada — Curated Gift Sets Outperform Individual Items', tags: ['gifting'], urgency: 'medium', summary: 'The Canadian baby gifting market has grown 24% year-over-year, with curated gift sets (book + toy + keepsake) outperforming individual item purchases by 3:1. Millennial and Gen Z parents show strong preference for "expert-curated" gift selections.', whyItMatters: 'IndigoBaby is well-positioned for the curated gift set trend. Marketing should emphasize the "expertly curated" angle and feature bundle options prominently — this is where Indigo\'s curation advantage converts directly to revenue.' },

    // Macro loop
    { titleTemplate: () => 'Holiday Spending Forecast Cautious — Canadians Plan to Spend 8% Less on Discretionary Gifts', tags: ['macro'], urgency: 'high', summary: 'Early holiday spending forecasts show Canadian consumers planning to reduce discretionary gift spending by 8% compared to last year. However, spending on "meaningful" and "experience" gifts is expected to hold steady, suggesting a quality-over-quantity shift rather than across-the-board cuts.', whyItMatters: 'A quality-over-quantity gifting environment favours Indigo over mass-market competitors. Marketing should emphasize curation, thoughtfulness, and the emotional value of Indigo\'s assortment rather than competing on volume or price.' },
    { titleTemplate: () => 'Inflation Sensitivity Rises for Non-Essential Retail — But Book Spending Remains Resilient', tags: ['macro'], urgency: 'medium', summary: 'Statistics Canada data shows rising inflation sensitivity across non-essential retail categories, but book spending has remained resilient, declining only 2% compared to 8-12% drops in apparel, electronics, and home furnishing. Books appear to benefit from their positioning as affordable indulgence.', whyItMatters: 'Book spending resilience is Indigo\'s anchor in a challenging retail environment. The "affordable indulgence" positioning should be emphasized in marketing — books as accessible luxury, especially relative to other discretionary categories.' },
    { titleTemplate: () => 'Canadian Convenience Expectations Rise — 74% of Shoppers Expect Same-Day or Next-Day Options', tags: ['macro'], urgency: 'medium', summary: 'A Deloitte Canada study finds 74% of Canadian shoppers now expect same-day or next-day delivery options from specialty retailers, up from 58% two years ago. Retailers without competitive delivery are losing share to Amazon and other platforms offering speed.', whyItMatters: 'Rising convenience expectations put pressure on Indigo\'s fulfillment capabilities. The in-store experience and BOPIS (buy online, pick up in store) are Indigo\'s speed advantages — marketing should frame them as convenience, not compromise.' },
  ];

  // First 21 templates are pinned (3 per category x 7 categories), rest are loop templates
  const pinnedTemplates = templates.slice(0, 21);
  const loopTemplates = templates.slice(21);

  const categoryTags: NewsTag[] = ['brand', 'publishing', 'genre', 'amazon', 'social', 'gifting', 'macro'];
  const categorySources: Record<string, string[][]> = {
    brand: [['Retail Insider', 'Financial Post', 'Strategy Online']],
    publishing: [['Publishers Weekly', 'BookNet Canada', 'Quill & Quire']],
    genre: [['BookNet Canada', 'Publishers Weekly', 'Goodreads']],
    amazon: [['Amazon.ca Bestsellers', 'Amazon.ca Category Data', 'Amazon.ca New Releases']],
    social: [['Reddit r/books', 'Reddit r/suggestmeabook', 'Reddit r/CanLit']],
    gifting: [['Retail Insider', 'Trend Hunter', 'Pinterest Trends']],
    macro: [['Statistics Canada', 'The Globe and Mail', 'Deloitte Canada']],
  };

  // Generate pinned articles (3 per category)
  categoryTags.forEach((tag, catIdx) => {
    const catTemplates = pinnedTemplates.filter(t => t.tags.includes(tag));
    const sources = categorySources[tag][0];
    catTemplates.forEach((tmpl, idx) => {
      items.push({
        id: `news-${tag}-${idx}`,
        title: tmpl.titleTemplate(),
        source: sources[idx % sources.length],
        date: format(subDays(END_DATE, catIdx + idx), 'yyyy-MM-dd'),
        tags: tmpl.tags,
        regions: ['north-america'] as RegionId[],
        urgency: tmpl.urgency,
        summary: tmpl.summary,
        whyItMatters: tmpl.whyItMatters,
        competitor: tmpl.competitor,
      });
    });
  });

  // Generate loop articles — one per template to avoid duplicates
  for (let i = 0; i < loopTemplates.length; i++) {
    const template = loopTemplates[i];
    const tag = template.tags[0];
    const daysAgo = randInt(0, 89);
    const date = format(subDays(END_DATE, daysAgo), 'yyyy-MM-dd');
    const sources = NEWS_SOURCES_BY_TAG[tag] || ['The Globe and Mail'];
    const regions = pickN(ALL_REGIONS, randInt(1, 3));

    items.push({
      id: `news-loop-${i}`,
      title: template.titleTemplate(),
      source: pick(sources),
      date,
      tags: template.tags,
      regions: regions,
      urgency: template.urgency,
      summary: template.summary,
      whyItMatters: template.whyItMatters,
      competitor: template.competitor,
    });
  }

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

// ===== Action Step Templates =====
const ACTION_STEP_TEMPLATES: Record<InsightCategory, Array<{ title: string; subtitle: string; type: InsightActionStep['type'] }>> = {
  performance: [
    { title: 'Optimize Budget Allocation', subtitle: 'REDISTRIBUTE SPEND ACROSS TOP AD SETS', type: 'budget' },
    { title: 'Adjust Channel Bids', subtitle: 'INCREASE BIDS ON HIGH-ROAS CHANNELS', type: 'bidding' },
    { title: 'Refine Audience Targeting', subtitle: 'NARROW TO HIGH-INTENT SEGMENTS', type: 'targeting' },
  ],
  creative: [
    { title: 'Refresh Creative Assets', subtitle: 'REPLACE FATIGUED AD UNITS WITH NEW VARIANTS', type: 'creative' },
    { title: 'A/B Test New Variants', subtitle: 'LAUNCH 3 NEW CREATIVE CONCEPTS', type: 'creative' },
    { title: 'Adjust Ad Scheduling', subtitle: 'SHIFT DELIVERY TO PEAK HOURS', type: 'scheduling' },
  ],
  competitive: [
    { title: 'Launch Conquest Campaign', subtitle: 'TARGET COMPETITOR AUDIENCES', type: 'targeting' },
    { title: 'Increase Brand Spend', subtitle: 'BOOST AWARENESS BUDGET BY 15%', type: 'budget' },
    { title: 'Adjust Bidding Strategy', subtitle: 'INCREASE BIDS ON CONTESTED TERMS', type: 'bidding' },
  ],
  platform: [
    { title: 'Update Bidding Strategy', subtitle: 'ALIGN WITH NEW ALGORITHM PREFERENCES', type: 'bidding' },
    { title: 'Adjust Ad Formats', subtitle: 'ADOPT PLATFORM-RECOMMENDED FORMATS', type: 'creative' },
    { title: 'Revise Targeting Parameters', subtitle: 'UPDATE AUDIENCE DEFINITIONS', type: 'targeting' },
  ],
  macro: [
    { title: 'Reallocate Regional Budget', subtitle: 'SHIFT SPEND TO FAVORABLE MARKETS', type: 'budget' },
    { title: 'Adjust Messaging', subtitle: 'UPDATE COPY FOR MARKET CONDITIONS', type: 'creative' },
    { title: 'Modify Flight Schedule', subtitle: 'RESCHEDULE CAMPAIGNS FOR OPTIMAL TIMING', type: 'scheduling' },
  ],
};

function generateActionSteps(category: InsightCategory, insightIndex: number): InsightActionStep[] {
  const templates = ACTION_STEP_TEMPLATES[category];
  const count = 1 + (insightIndex % 3); // 1-3 steps
  const steps: InsightActionStep[] = [];
  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length];
    steps.push({
      id: `step-${insightIndex}-${i}`,
      title: t.title,
      subtitle: t.subtitle,
      type: t.type,
      completed: false,
    });
  }
  return steps;
}

// ===== Curated Insight Generation =====
function generateInsights(_anomalies: Anomaly[]): Insight[] {
  const today = format(END_DATE, 'yyyy-MM-dd');
  const yesterday = format(subDays(END_DATE, 1), 'yyyy-MM-dd');
  const twoDaysAgo = format(subDays(END_DATE, 2), 'yyyy-MM-dd');

  const curated: Insight[] = [
    // ── CAMPAIGN group (scope=campaign, category≠creative) ──
    {
      id: 'insight-pacing-1',
      createdAt: today,
      scope: 'campaign',
      category: 'performance',
      region: 'north-america',
      campaign: 'ind-plum-growth',
      channels: ['instagram', 'facebook', 'tiktok'],
      title: 'Pacing to Underspend',
      recommendedAction: 'Increase daily budget or expand targeting to hit flight budget',
      summary: 'Plum+ Membership Growth daily spend rate projects a $38K underspend by flight end. Expanding Plum+ lookalike audiences or increasing bid caps will close the gap before the spring membership push.',
      evidence: ['Projected spend: $6.38M of $6.42M budget', 'Daily run rate $2.1K below target', '18 days remaining in flight'],
      impactEstimate: '+$38K utilization',
      confidence: 88,
      status: 'new',
      actionSteps: generateActionSteps('performance', 0),
    },
    {
      id: 'insight-cpa-above',
      createdAt: twoDaysAgo,
      scope: 'campaign',
      category: 'performance',
      region: 'north-america',
      campaign: 'ind-holiday-gift',
      channels: ['google-search', 'instagram'],
      title: 'CPA Trending Above Target',
      recommendedAction: 'Tighten targeting or reduce bid caps on broad search terms',
      summary: 'Holiday Gift Guide cost per conversion has risen 18% above target. Generic gift search terms are driving inefficiency compared to branded Indigo queries.',
      evidence: ['Current CPA $53 vs $45 target', 'Generic terms CPA is 2.1x branded CPA', 'Bid cap exceeded on 3 ad groups'],
      impactEstimate: '-$8K efficiency',
      confidence: 79,
      status: 'new',
      actionSteps: generateActionSteps('performance', 2),
    },

    // ── CROSS CHANNEL group (scope=brand|region, category≠creative) ──
    {
      id: 'insight-channel-mix',
      createdAt: today,
      scope: 'brand',
      category: 'performance',
      channels: ['instagram', 'google-search', 'facebook'],
      title: 'Channel Mix Imbalance',
      recommendedAction: 'Shift budget from saturated social to high-intent search',
      summary: 'Instagram is receiving 40% of total budget but generating only 18% of conversions. Google Search shows 3.2x higher ROAS with room to scale for seasonal gifting.',
      evidence: ['Instagram ROAS: 1.2x vs Google Search ROAS: 3.8x', '40% budget → 18% conversions on Instagram', 'Google Search impression share only 62%'],
      impactEstimate: '+$28K rev potential',
      confidence: 91,
      status: 'new',
      actionSteps: generateActionSteps('performance', 3),
    },
    {
      id: 'insight-meta-diminishing',
      createdAt: yesterday,
      scope: 'region',
      category: 'platform',
      region: 'north-america',
      channels: ['facebook', 'google-search'],
      title: 'Diminishing Returns on Meta',
      recommendedAction: 'Reallocate excess Facebook spend to Google Search',
      summary: 'Incremental CPA on Facebook has risen 35% as audience overlap between ad sets reaches 45%. Moving $5K weekly to Search would improve blended efficiency heading into the spring gifting season.',
      evidence: ['Facebook incremental CPA up 35% MoM', 'Audience overlap at 45% across 4 ad sets', 'Google Search has 38% headroom on impression share'],
      impactEstimate: '-$4.2K CPA savings',
      confidence: 85,
      status: 'new',
      actionSteps: generateActionSteps('platform', 4),
    },
    {
      id: 'insight-freq-cap',
      createdAt: twoDaysAgo,
      scope: 'brand',
      category: 'performance',
      channels: ['instagram', 'facebook', 'tiktok', 'ttd'],
      title: 'Cross-Channel Frequency Cap',
      recommendedAction: 'Cap combined exposure to reduce ad fatigue',
      summary: 'Users are seeing Indigo ads an average of 12.4 times per week across channels, well above the 8x optimal threshold. Excess frequency is driving CPM inflation without conversion lift.',
      evidence: ['Average weekly frequency: 12.4x (target: 8x)', 'CTR drops 40% after 9th impression', 'Estimated waste: $6K/week in excess impressions'],
      impactEstimate: '-$6K waste/wk',
      confidence: 87,
      status: 'new',
      actionSteps: generateActionSteps('performance', 5),
    },

    // ── AD group (category=creative) ──
    {
      id: 'insight-fatigue-1',
      createdAt: today,
      scope: 'campaign',
      category: 'creative',
      region: 'north-america',
      campaign: 'ind-booktok-readers',
      channels: ['instagram', 'tiktok'],
      title: 'Possible Creative Fatigue',
      recommendedAction: 'Refresh BookTok creative with new trending titles and UGC-style variants',
      summary: 'Primary BookTok reader creative has been running for 21 days with CTR declining steadily. Frequency has reached 6.8x in the core 18-34 reader audience, indicating ad fatigue.',
      evidence: ['CTR declined 28% over 14 days', 'Frequency reached 6.8x in primary audience', 'Creative fatigue index: 72/100'],
      impactEstimate: '+18% CTR recovery',
      confidence: 84,
      status: 'new',
      actionSteps: generateActionSteps('creative', 6),
    },
    {
      id: 'insight-fatigue-2',
      createdAt: yesterday,
      scope: 'campaign',
      category: 'creative',
      region: 'north-america',
      campaign: 'ind-plum-growth',
      channels: ['instagram', 'tiktok'],
      title: 'Possible Creative Fatigue',
      recommendedAction: 'Pause spend on underperforming ad',
      summary: 'Plum+ membership promo video has reached saturation with completion rates dropping below 15%. The Plum+ Value Maxer audience has been heavily exposed over the past 3 weeks.',
      evidence: ['Video completion rate dropped from 28% to 14%', 'Frequency: 5.4x in lookalike audience', 'CPA increased 32% for this creative'],
      impactEstimate: '+22% VCR recovery',
      confidence: 78,
      status: 'new',
      actionSteps: generateActionSteps('creative', 7),
    },
    {
      id: 'insight-fatigue-3',
      createdAt: twoDaysAgo,
      scope: 'campaign',
      category: 'creative',
      region: 'north-america',
      campaign: 'ind-gift-givers',
      channels: ['instagram', 'tiktok'],
      title: 'Possible Creative Fatigue',
      recommendedAction: 'Pause spend on underperforming ad',
      summary: 'Gift guide carousel in Gift Givers & Seasonal Shoppers campaign shows declining engagement. Swipe rate has halved while CPC has doubled, suggesting creative exhaustion.',
      evidence: ['Swipe rate dropped 52% in 10 days', 'CPC increased from $1.20 to $2.45', 'Engagement rate: 1.1% (was 2.8%)'],
      impactEstimate: '+$2.1K efficiency',
      confidence: 81,
      status: 'new',
      actionSteps: generateActionSteps('creative', 8),
    },
    {
      id: 'insight-scale-top',
      createdAt: today,
      scope: 'campaign',
      category: 'creative',
      region: 'north-america',
      campaign: 'ind-plum-growth',
      channels: ['tiktok', 'instagram'],
      title: 'Top Performer Ready to Scale',
      recommendedAction: 'Increase budget allocation to top creative',
      summary: 'New UGC-style Plum+ member testimonial video is outperforming all other creatives by 2.4x on ROAS. Currently capped at 15% of ad set budget — scaling to 35% is projected to improve overall campaign ROAS.',
      evidence: ['Creative ROAS: 4.8x vs campaign avg 2.0x', 'Only receiving 15% of ad set budget', 'No fatigue signals after 12 days'],
      impactEstimate: '+$18K rev potential',
      confidence: 92,
      status: 'new',
      actionSteps: generateActionSteps('creative', 9),
    },
    {
      id: 'insight-low-engage',
      createdAt: yesterday,
      scope: 'campaign',
      category: 'creative',
      region: 'north-america',
      campaign: 'ind-bestseller',
      channels: ['facebook', 'instagram'],
      title: 'Low Engagement Variant',
      recommendedAction: 'Replace or refresh underperforming creative',
      summary: 'Static bestseller list image variant C has the lowest engagement rate across all active creatives at 0.8%. Budget is being wasted on an asset that fails to capture attention in the Bestseller Awareness campaign.',
      evidence: ['Engagement rate: 0.8% (campaign avg: 2.3%)', 'CTR: 0.4% vs 1.2% campaign average', 'Zero conversions attributed in last 7 days'],
      impactEstimate: '+$3.5K reallocation',
      confidence: 90,
      status: 'new',
      actionSteps: generateActionSteps('creative', 10),
    },

    // ── Additional AD insights ──
    {
      id: 'insight-hook-retention',
      createdAt: today,
      scope: 'campaign',
      category: 'creative',
      region: 'north-america',
      campaign: 'ind-plum-growth',
      channels: ['instagram', 'tiktok'],
      title: 'Low Early Hook Retention',
      recommendedAction: 'Pause spend on underperforming ad',
      summary: "Your 1-3 second view rate is declining, leading to early abandonment. This significantly lowers the algorithm's efficiency and increases your cost per result. Reduce delivery and test new hook variants or alternative opening sequences.",
      evidence: ['3s view rate dropped from 45% to 28% over 10 days', 'Cost per result increased 34%', 'Algorithm efficiency score declining steadily'],
      impactEstimate: '+32% view rate recovery',
      confidence: 86,
      status: 'new',
      actionSteps: generateActionSteps('creative', 11),
    },

    // ── Additional CROSS CHANNEL insights ──
    {
      id: 'insight-channel-saturation',
      createdAt: today,
      scope: 'brand',
      category: 'performance',
      channels: ['instagram', 'tiktok'],
      title: 'Channel Saturation Detected',
      recommendedAction: 'Reallocate spend from Bowls product line',
      summary: 'Performance is declining as frequency climbs, indicating this channel has reached its saturation point. Reallocating budget to channels with lower marginal costs will improve your overall portfolio efficiency.',
      evidence: ['Frequency up 40% while CTR down 25%', 'Diminishing returns threshold exceeded', 'Alternative channels showing significant headroom'],
      impactEstimate: '+$15K efficiency',
      confidence: 88,
      status: 'new',
      actionSteps: generateActionSteps('performance', 12),
    },
    {
      id: 'insight-channel-dependence',
      createdAt: yesterday,
      scope: 'brand',
      category: 'performance',
      channels: ['instagram', 'tiktok', 'facebook'],
      title: 'Excessive Channel Dependence',
      recommendedAction: 'Diversify portfolio to reduce risk',
      summary: "A single channel currently accounts for an unusually high percentage of your total spend while performance metrics are declining. This over-reliance creates account instability; redistributing funds to diversified channels with comparable potential will lower your overall risk.",
      evidence: ['Single channel at 65% of total spend', 'Channel ROAS declining 18% MoM', 'Portfolio risk score: High'],
      impactEstimate: '-$12K risk reduction',
      confidence: 83,
      status: 'new',
      actionSteps: generateActionSteps('performance', 13),
    },
    {
      id: 'insight-channel-divergence',
      createdAt: yesterday,
      scope: 'brand',
      category: 'performance',
      channels: ['instagram', 'tiktok'],
      title: 'Channel Performance Divergence',
      recommendedAction: 'Reallocate spend from influencer content',
      summary: "One channel's performance is improving while another is declining over the same period. This shift \u2014 likely driven by consumer behaviour or algorithm changes \u2014 presents an opportunity to reallocate spend toward the improving channel to protect your overall efficiency.",
      evidence: ['TikTok ROAS up 25% vs Instagram down 15%', 'Audience engagement shifting platforms', 'Algorithm favouring short-form content'],
      impactEstimate: '+$22K optimization',
      confidence: 85,
      status: 'new',
      actionSteps: generateActionSteps('performance', 14),
    },
    {
      id: 'insight-channel-opportunity',
      createdAt: twoDaysAgo,
      scope: 'brand',
      category: 'performance',
      channels: ['tiktok', 'instagram'],
      title: 'New Channel Opportunity Detected',
      recommendedAction: 'Reallocate spend to test potential on Bowls product line',
      summary: 'This channel shows strong performance signals and low costs (CPM), but current spend remains low. Increasing the budget here while reducing your lowest-efficiency channels will test its full scaling potential.',
      evidence: ['Channel CPM 40% below average', 'Early ROAS signals at 3.2x', 'Only 5% of total budget allocated'],
      impactEstimate: '+$18K scaling potential',
      confidence: 87,
      status: 'new',
      actionSteps: generateActionSteps('performance', 15),
    },
  ];

  return curated;
}

// ===== Main Data Store =====
export interface MockDataStore {
  campaigns: Campaign[];
  dailyData: Record<string, Record<string, DailyMetrics[]>>;
  newsItems: NewsItem[];
  insights: Insight[];
  anomalies: Anomaly[];
}

let cachedStore: MockDataStore | null = null;

export function generateAllData(): MockDataStore {
  if (cachedStore) return cachedStore;

  const campaigns: Campaign[] = CAMPAIGN_DEFS.map(def => ({
    id: def.id,
    name: def.name,
    region: def.region,
    objective: def.objective,
    status: def.status,
    channels: def.channels,
    countries: def.countries,
    startDate: format(START_DATE, 'yyyy-MM-dd'),
    plannedBudget: def.plannedBudget,
  }));

  const dailyData = generateDailyData();
  const anomalies = detectAnomalies(dailyData);
  const newsItems = generateNews();
  const insights = generateInsights(anomalies);

  cachedStore = { campaigns, dailyData, newsItems, insights, anomalies };
  return cachedStore;
}
