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
  // ── Loyalty Campaigns ──
  // Loyalty App Acquisition — drive new app downloads and Pizza Pizza Club sign-ups
  { id: 'pp-loyalty-app', name: 'Loyalty App Acquisition', region: 'north-america', objective: 'performance', status: 'live',
    channels: ['google-search', 'facebook', 'instagram', 'ttd', 'spotify'], budgetMultiplier: 1.0136, plannedBudget: 1600000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB'] },
  // Loyalty Retention & Upsell — re-engage existing Pizza Pizza Club members, drive repeat orders and higher AOV
  { id: 'pp-loyalty-retain', name: 'Loyalty Retention & Upsell', region: 'north-america', objective: 'performance', status: 'live',
    channels: ['facebook', 'instagram', 'google-search'], budgetMultiplier: 0.8450, plannedBudget: 980000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL'] },

  // ── Persona-Based Campaigns ──
  // TikTok Foodies — social-first food discovery audience, 18-34, trending food content
  { id: 'pp-tiktok-foodies', name: 'TikTok Foodies', region: 'north-america', objective: 'awareness', status: 'live',
    channels: ['tiktok', 'instagram', 'spotify'], budgetMultiplier: 1.2200, plannedBudget: 1100000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'NS'] },
  // Family Meal Deals — families seeking value meal bundles, seasonal promotions
  { id: 'pp-family-deals', name: 'Family Meal Deals', region: 'north-america', objective: 'performance', status: 'live',
    channels: ['google-search', 'facebook', 'instagram', 'ttd', 'ctv'], budgetMultiplier: 1.4800, plannedBudget: 2200000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT'] },
  // Late Night Cravings — 18-35, late-night ordering, delivery-first
  { id: 'pp-late-night', name: 'Late Night Cravings', region: 'north-america', objective: 'consideration', status: 'live',
    channels: ['facebook', 'instagram', 'google-search'], budgetMultiplier: 1.1050, plannedBudget: 1050000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB'] },
  // Plant-Based & Better-For-You — health-conscious consumers, plant-based menu items
  { id: 'pp-plant-based', name: 'Plant-Based & Better-For-You', region: 'north-america', objective: 'consideration', status: 'live',
    channels: ['instagram', 'tiktok', 'facebook', 'ctv'], budgetMultiplier: 1.1500, plannedBudget: 980000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'NS'] },

  // ── Core QSR Campaigns ──
  // Game Day & Sports Moments — peak seasonal push around sports events across all provinces
  { id: 'pp-game-day', name: 'Game Day & Sports Moments', region: 'north-america', objective: 'performance', status: 'live',
    channels: ['instagram', 'facebook', 'tiktok', 'google-search', 'ttd', 'ctv', 'spotify'], budgetMultiplier: 1.6116, plannedBudget: 3720000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT'] },
  // New Menu Launch — new menu items and LTOs
  { id: 'pp-new-menu', name: 'New Menu Launch', region: 'north-america', objective: 'awareness', status: 'live',
    channels: ['instagram', 'facebook', 'ttd', 'ctv', 'spotify'], budgetMultiplier: 0.6286, plannedBudget: 1400000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE'] },
  // Catering & Group Orders — office catering, party platters, group ordering
  { id: 'pp-catering', name: 'Catering & Group Orders', region: 'north-america', objective: 'consideration', status: 'live',
    channels: ['instagram', 'tiktok', 'facebook'], budgetMultiplier: 1.349, plannedBudget: 1400000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'NS'] },
  // Digital Ordering Retargeting — PizzaPizza.ca and app conversion
  { id: 'pp-digital-orders', name: 'Digital Ordering Retargeting', region: 'north-america', objective: 'performance', status: 'live',
    channels: ['google-search', 'ttd', 'facebook'], budgetMultiplier: 0.5231, plannedBudget: 930000,
    countries: ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE'] },
];

// ===== Events (anomaly generators) =====
interface DataEvent {
  name: string; dayOffset: number; duration: number;
  regions: RegionId[]; spendMult: number; cvrMult: number; engageMult: number;
}

const DATA_EVENTS: DataEvent[] = [
  { name: 'Super Bowl Campaign Push', dayOffset: 45, duration: 7, regions: ['north-america'], spendMult: 1.8, cvrMult: 1.3, engageMult: 2.0 },
  { name: 'UberEats/DoorDash Promo War', dayOffset: 90, duration: 10, regions: ['north-america'], spendMult: 1.0, cvrMult: 0.8, engageMult: 0.7 },
  { name: 'NHL Playoffs Surge', dayOffset: 70, duration: 14, regions: ALL_REGIONS, spendMult: 1.3, cvrMult: 1.15, engageMult: 1.4 },
  { name: 'TikTok Algorithm Shift', dayOffset: 100, duration: 5, regions: ALL_REGIONS, spendMult: 1.0, cvrMult: 0.75, engageMult: 1.6 },
  { name: 'Holiday Catering Season', dayOffset: 150, duration: 10, regions: ['north-america'], spendMult: 1.5, cvrMult: 1.1, engageMult: 1.1 },
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
  qsr: ['QSR Magazine', 'Technomic', 'Foodservice & Hospitality', 'The Globe and Mail', 'Restaurants Canada'],
  menu: ['Technomic', 'QSR Magazine', 'Food in Canada', 'Restaurants Canada', 'NPD Group'],
  delivery: ['UberEats Data', 'DoorDash Insights', 'SkipTheDishes Analytics', 'Technomic', 'Second Measure'],
  social: ['Reddit r/pizza', 'Reddit r/foodToronto', 'Reddit r/CanadianFood', 'TikTok #FoodTok', 'Reddit r/FastFood'],
  sports: ['TSN', 'Sportsnet', 'Retail Insider', 'Strategy Online', 'Financial Post'],
  sponsorships: ['TSN', 'Sportsnet', 'The Athletic', 'Daily Faceoff', 'CFL.ca', 'PWHL News'],
  competitors: ['Retail Insider', 'Financial Post', 'QSR Magazine', 'RedFlagDeals', 'Strategy Online', 'Technomic'],
  macro: ['Statistics Canada', 'The Globe and Mail', 'Financial Post', 'Deloitte Canada', 'CBC News'],
};

function generateNews(): NewsItem[] {
  const items: NewsItem[] = [];
  const templates: Array<{
    titleTemplate: (c?: string) => string; tags: NewsTag[]; urgency: NewsUrgency;
    summary: string; whyItMatters: string; competitor?: string;
  }> = [
    // ── 1. Brand & Corporate Narrative (3 pinned) ──
    { titleTemplate: () => 'Pizza Pizza Mentions Surge After CEO Interview on Canadian QSR Expansion Strategy', tags: ['brand'], urgency: 'high', summary: 'Pizza Pizza CEO\'s interview on BNN Bloomberg discussing the 750+ location expansion strategy and digital ordering transformation generated significant media pickup and social conversation, with brand mentions up 280% in 48 hours. Coverage framed Pizza Pizza as a differentiated Canadian QSR leader rather than a legacy pizza chain.', whyItMatters: 'The narrative is shifting toward strategic relevance and growth positioning — this is the story Pizza Pizza wants the market to tell. Amplify before the news cycle moves on.' },
    { titleTemplate: () => 'Pizza Pizza Club Loyalty Program Surpasses 2M Members — Digital Orders Drive Growth', tags: ['brand'], urgency: 'high', summary: 'Pizza Pizza\'s loyalty program has surpassed 2M active members. Media coverage highlights the 2.8x higher order frequency among members and the program\'s role in driving digital ordering adoption, with analysts noting it as a competitive advantage against aggregator platforms.', whyItMatters: 'The loyalty narrative is now working in Pizza Pizza\'s favour — membership is being framed as a digital moat against delivery aggregators. This supports direct-ordering positioning across all customer-facing communications.' },
    { titleTemplate: () => 'Pizza Pizza ESG Report Highlights Sustainable Packaging and Local Sourcing — Mixed Reception', tags: ['brand'], urgency: 'medium', summary: 'Pizza Pizza\'s latest ESG report highlights compostable packaging rollout and Canadian-sourced ingredients initiatives. Reception is mixed: sustainability advocates praise the direction while critics question the pace relative to global QSR peers.', whyItMatters: 'ESG narrative requires careful management — positive signals exist but the story isn\'t fully landed. Monitor sentiment and consider proactive communication to control the framing.' },

    // ── 2. QSR Industry & Market Trends (3 pinned) ──
    { titleTemplate: () => 'Canadian QSR Revenue Hits $38B — Digital Ordering and Delivery Drive Growth', tags: ['qsr'], urgency: 'high', summary: 'Restaurants Canada reports the QSR sector revenue rose to $38B in 2024, with continued growth from digital ordering platforms and delivery services. In-store traffic remains strong but mobile ordering and third-party delivery adoption is accelerating, particularly among 18-34 consumers.', whyItMatters: 'The Canadian QSR market is growing and diversifying. Pizza Pizza must track where the growth is coming from — digital vs. in-store, delivery vs. pickup — to ensure menu strategy and marketing stay aligned with actual demand patterns.' },
    { titleTemplate: () => 'Third-Party Delivery Commission Rates Rise to 30% — QSR Margins Under Pressure', tags: ['qsr'], urgency: 'medium', summary: 'Technomic reports third-party delivery platform commissions have risen to 25-30% on average, squeezing QSR margins. Chains with strong direct-ordering capabilities are outperforming those dependent on aggregators, with 4-8% higher margins on direct digital orders.', whyItMatters: 'Rising delivery commissions validate Pizza Pizza\'s investment in direct ordering through the app and website. The margin advantage of direct orders should be emphasized in all digital marketing and loyalty program communications.' },
    { titleTemplate: () => 'Canadian QSR Chains Report Value Menu Resurgence — Price Sensitivity Drives Traffic', tags: ['qsr'], urgency: 'medium', summary: 'Multiple Canadian QSR chains report surging value menu sales driven by inflation-conscious consumers. Combo deals and family meal bundles are seeing 40-60% sales increases, with value positioning becoming a primary traffic driver.', whyItMatters: 'Value menu resurgence is predictable and actionable — Pizza Pizza should build promotional playbooks around value-forward messaging and family bundle offers to capture demand before competitors respond.' },

    // ── 3. Menu Innovation & Food Trends (3 pinned) ──
    { titleTemplate: () => 'Plant-Based Pizza Demand Surges — Technomic Flags Category as Fastest-Growing QSR Segment', tags: ['menu'], urgency: 'high', summary: 'Technomic\'s latest menu trends report shows plant-based pizza options as the fastest-growing QSR menu category in Canada, with unit sales up 34% year-over-year. The surge is driven by flexitarian consumers, TikTok food content, and crossover appeal from health-conscious demographics.', whyItMatters: 'Plant-based is accelerating faster than most QSR chains have adjusted for. Pizza Pizza should evaluate menu positioning, app prominence, and marketing creative to capture this momentum while it\'s still building.' },
    { titleTemplate: () => 'Loaded Crust and Premium Toppings Continue to Dominate — LTO Pre-Orders Break Records', tags: ['menu'], urgency: 'high', summary: 'Premium pizza innovations continue their dominance, with loaded crust and premium topping LTOs setting pre-order records across Canadian QSR. Specialty ingredients, global flavour profiles, and Instagram-worthy presentations are driving average ticket up 22%.', whyItMatters: 'Premium pizza innovation is not a trend — it\'s a category shift. Pizza Pizza should treat premium LTOs as a permanent menu strategy with dedicated marketing investment and social content.' },
    { titleTemplate: () => 'r/pizza Buzzing Over New Detroit-Style Deep Dish — Thread Hits 4.2K Upvotes in 48 Hours', tags: ['menu'], urgency: 'high', summary: 'A thread on r/pizza about Detroit-style deep dish pizza has exploded, hitting 4.2K upvotes and 800+ comments in 48 hours. Users describe it as "the next big pizza trend" with comparisons to the Neapolitan wave. Multiple commenters are requesting Canadian chains add it to their menus.', whyItMatters: 'Reddit-driven food trend signals are early and high-conviction — when a thread hits this velocity, mainstream demand follows within weeks. Pizza Pizza should evaluate Detroit-style as a potential LTO and align social content to the conversation already happening.' },

    // ── 4. Delivery Platform Intelligence (3 pinned) ──
    { titleTemplate: () => 'UberEats Canada Data: Pizza Holds 3 of Top 5 Most-Ordered Categories for Third Consecutive Month', tags: ['delivery'], urgency: 'high', summary: 'UberEats Canada data shows pizza-related categories dominate the most-ordered list, with 3 of the top 5 spots held for a third consecutive month. Pepperoni pizza, pizza combos, and late-night pizza orders are driving volume. Order velocity on promotional items suggests sustained demand.', whyItMatters: 'Delivery platform data is a real-time demand signal. When pizza holds this concentration for three consecutive months, it confirms category-level demand that Pizza Pizza should match with promotional investment and delivery-specific marketing.' },
    { titleTemplate: () => 'DoorDash Insights: "Healthy Pizza" and "Cauliflower Crust" Searches Climbing Fast', tags: ['delivery'], urgency: 'medium', summary: 'DoorDash\'s search trend data shows rapid climbing by "healthy pizza," "cauliflower crust," and "gluten-free pizza" searches. Several health-positioned pizza items have moved from outside the top 100 to the top 20 searches within two weeks.', whyItMatters: 'Items climbing quickly on delivery platforms signal emerging demand before it peaks. Pizza Pizza can use these signals to position health-conscious menu options early and capture the demand curve.' },
    { titleTemplate: () => 'SkipTheDishes Data Shows Pizza Order Patterns Diverge by Daypart — Signals Distinct Demand', tags: ['delivery'], urgency: 'high', summary: 'SkipTheDishes analytics reveal pizza ordering patterns now diverge meaningfully by daypart, with lunch orders skewing toward personal-size and value items while dinner and late-night orders favour family bundles and premium options. The patterns suggest distinct customer segments with different needs.', whyItMatters: 'The daypart divergence confirms that pizza ordering behaviour varies significantly by time of day. Pizza Pizza should optimize delivery promotions and menu features by daypart rather than running uniform offers.' },

    // ── 5. Social & Food Culture (3 pinned) ──
    { titleTemplate: () => 'r/pizza "What\'s Your Go-To Order?" Weekly Thread Surfaces Regional Pizza Preferences — Canadian Chains Overrepresented', tags: ['social'], urgency: 'high', summary: 'The r/pizza weekly thread has surfaced strong regional preferences, with Canadian commenters showing 4x the average engagement. Multiple users recommend Pizza Pizza for value and consistency, and the thread mirrors previous Reddit-driven brand momentum patterns.', whyItMatters: 'Reddit food threads are high-signal discovery channels — engaged eaters sharing genuine recommendations carry more purchase conviction than algorithmic feeds. Pizza Pizza should monitor these threads as early brand sentiment indicators.' },
    { titleTemplate: () => 'r/foodToronto "Best Late-Night Pizza" Requests Up 280% — Delivery Speed as Key Differentiator', tags: ['social'], urgency: 'medium', summary: 'The r/foodToronto community is seeing a 280% increase in "best late-night pizza" recommendation requests, with users seeking fast delivery, consistent quality, and value pricing. Thread discussions frequently mention Pizza Pizza as a reliable late-night option with fast delivery times.', whyItMatters: 'Late-night pizza demand is a high-frequency, high-loyalty segment. Reddit sentiment validates Pizza Pizza\'s delivery speed advantage — this should be amplified in late-night digital marketing.' },
    { titleTemplate: () => 'r/CanadianFood Community Drives Buzz for Regional Pizza Styles — Correlation with Order Surges Strengthening', tags: ['social'], urgency: 'medium', summary: 'The r/CanadianFood subreddit\'s discussion threads around regional pizza styles are increasingly correlated with order surges at Canadian chains. Styles featured in top threads see 3-5x higher order rates, with the effect strongest for chains mentioned by name.', whyItMatters: 'Reddit food communities surface demand signals that are higher-conviction than algorithmic recommendations. Pizza Pizza should monitor r/CanadianFood and use discussion velocity to inform promotional strategy and regional menu features.' },

    // ── 6. Sports, Events & Partnerships (3 pinned) ──
    { titleTemplate: () => 'Game Day Pizza Orders Surge 340% During NHL Playoffs — QSR Brands Race to Capture Sports Moments', tags: ['sports'], urgency: 'high', summary: 'QSR industry data shows pizza orders surge 340% during NHL playoff games, with the effect strongest in Canadian markets. Brands with pre-game ordering features, sports partnerships, and real-time promotional triggers are capturing disproportionate share of the demand spike.', whyItMatters: 'Sports-driven pizza ordering is predictable and massive. Pizza Pizza\'s presence across Canadian markets and delivery capabilities position it to capture this demand — but only with proactive sports-moment marketing and pre-game ordering campaigns.' },
    { titleTemplate: () => 'Super Bowl Pizza Demand Forecast Up 42% — Pre-Order Windows Driving Early Commitment', tags: ['sports'], urgency: 'high', summary: 'Super Bowl pizza demand forecasts show a 42% increase over last year, with pre-order features driving 65% of orders to be placed 24+ hours in advance. QSR brands with early pre-order capabilities and party-size bundles are expected to capture the majority of incremental demand.', whyItMatters: 'Super Bowl is the single biggest pizza ordering day of the year. Pizza Pizza should launch pre-order campaigns early and feature party platters and group bundles prominently in all channels.' },
    { titleTemplate: () => 'Raptors Partnership and Arena Presence Drive Brand Recall Among 18-34 Demographic', tags: ['sports'], urgency: 'medium', summary: 'Sports marketing analytics show QSR brands with arena presence and team partnerships see 2.8x higher brand recall among 18-34 consumers. In-arena activations, courtside branding, and social media co-promotions with teams are the highest-impact touchpoints.', whyItMatters: 'Sports partnerships are a high-value brand-building channel for QSR. Pizza Pizza should evaluate arena presence ROI and consider expanding sports marketing investment to capture the young-adult demographic that indexes highest for pizza ordering.' },

    // ── 7. Corporate Sponsorships (3 pinned) ──
    { titleTemplate: () => 'Maple Leafs Playoff Push Ignites Toronto — City-Wide Watch Parties Expected to Drive Record Pizza Demand', tags: ['sponsorships'], urgency: 'high', summary: 'The Toronto Maple Leafs have clinched a playoff berth with home-ice advantage, and the city is buzzing. Sports analysts project record viewership for the first-round series, with bars, restaurants, and living rooms across the GTA expected to host massive watch parties. Historical data shows pizza orders in Toronto surge 4-5x during Leafs playoff games.', whyItMatters: 'As a Maple Leafs corporate sponsor, Pizza Pizza has a unique activation window. Playoff games are the highest-engagement moments for the partnership — coordinated in-arena promotions, social content tied to game outcomes, and geo-targeted delivery ads around Scotiabank Arena can capture disproportionate share of the demand spike.' },
    { titleTemplate: () => 'PWHL Championship Series Draws Record Viewership — League Audience Up 180% Year-Over-Year', tags: ['sponsorships'], urgency: 'high', summary: 'The PWHL Championship Series is drawing record audiences, with viewership up 180% year-over-year and significant growth in the 18-34 female demographic. The league\'s Toronto and Montreal franchises are leading attendance, and social media engagement around the championship is outpacing projections by 3x.', whyItMatters: 'PWHL\'s explosive growth makes Pizza Pizza\'s sponsorship increasingly valuable. The league\'s audience skews younger and more digitally engaged than traditional hockey — ideal for social-first activations, TikTok content tied to game moments, and loyalty program cross-promotions targeting an underserved demographic.' },
    { titleTemplate: () => 'BC Lions Announce 2026 Season Opener at BC Place — CFL Pre-Season Buzz Building in Western Canada', tags: ['sponsorships'], urgency: 'medium', summary: 'The BC Lions have announced their 2026 season opener at BC Place with expanded fan activations and partner integrations. CFL pre-season buzz is building across Western Canada, with ticket sales up 22% and social media engagement around the Lions brand trending upward as the league invests in younger fan engagement.', whyItMatters: 'The BC Lions season opener is an anchor activation moment for Pizza Pizza\'s CFL sponsorship in Western Canada. Early-season games generate outsized media attention and fan enthusiasm — the ideal window for in-stadium sampling, co-branded content, and regional delivery promotions tied to the Lions brand.' },

    // ── 8. Competitor Watch (3 pinned) ──
    { titleTemplate: () => 'Domino\'s Launches "Emergency Pizza" Loyalty Promotion — Free Pizza on Any Order Over $15', tags: ['competitors'], urgency: 'high', competitor: 'Domino\'s', summary: 'Domino\'s Canada has launched its "Emergency Pizza" promotion, offering loyalty members a free medium pizza redeemable within 30 days on any order over $15. The campaign is running across digital, TV, and social channels with heavy investment in TikTok creator partnerships. Early reports suggest a 25% spike in app downloads in the first week.', whyItMatters: 'Domino\'s is using aggressive loyalty mechanics to drive app installs and lock in repeat ordering behaviour. The "free pizza" hook is a direct acquisition play targeting price-sensitive consumers — the same segment Pizza Pizza competes for with family deals and value promotions.' },
    { titleTemplate: () => 'Pizza Nova Expands to 200 Locations — Western Canada Entry Signals National Ambition', tags: ['competitors'], urgency: 'high', competitor: 'Pizza Nova', summary: 'Pizza Nova has opened its 200th location and announced plans to enter Western Canada for the first time, targeting Calgary and Edmonton. The expansion is backed by a new franchise model offering lower initial investment and a refreshed store design. Pizza Nova is positioning its Italian heritage and fresh-dough messaging as key differentiators.', whyItMatters: 'Pizza Nova\'s Western expansion puts direct competitive pressure on Pizza Pizza\'s stronghold markets. Their fresh-dough and Italian-heritage positioning targets the premium-value segment — Pizza Pizza should monitor whether this messaging resonates and whether it erodes share in overlapping markets.' },
    { titleTemplate: () => 'Pizza Hut Rolls Out $7.99 Lunch Combo Nationwide — Aggressive Value Play Targets Weekday Daypart', tags: ['competitors'], urgency: 'high', competitor: 'Pizza Hut', summary: 'Pizza Hut Canada has launched a $7.99 lunch combo available Monday-Friday from 11AM-2PM, featuring a personal pizza, drink, and breadstick. The promotion is supported by a national TV and digital campaign with heavy Google Search investment on "cheap lunch" and "lunch deals near me" keywords.', whyItMatters: 'Pizza Hut\'s lunch combo is a direct attack on the weekday lunch daypart — an area where Pizza Pizza competes for quick-service occasions. The $7.99 price point is designed to undercut competitors and drive trial. Monitor whether this shifts Pizza Pizza\'s lunch traffic in overlapping markets.' },

    // ── 9. Macro Consumer & QSR Environment (3 pinned) ──
    { titleTemplate: () => 'Canadian Consumer Confidence Dips in Q1 2026 — Discretionary Spending Under Pressure', tags: ['macro'], urgency: 'high', summary: 'The Conference Board of Canada reports consumer confidence declined in Q1 2026, with 62% of Canadians reporting they plan to reduce discretionary spending over the next 6 months. QSR and fast-casual categories show relative resilience as consumers trade down from full-service dining.', whyItMatters: 'A cautious spending environment means Pizza Pizza must emphasize value, convenience, and everyday affordability in all communications. Premium-only strategies will underperform; value-forward positioning wins.' },
    { titleTemplate: () => 'Digital Ordering Share of Canadian QSR Reaches 38% — Mobile-First Chains Outperform', tags: ['macro'], urgency: 'medium', summary: 'Restaurants Canada reports digital ordering now represents 38% of total QSR sales, up from 29% a year ago. Chains with strong mobile apps, loyalty integration, and direct ordering capabilities are growing 2.3x faster than those dependent on third-party platforms.', whyItMatters: 'Digital ordering is no longer optional — it\'s the growth driver. Pizza Pizza\'s investment in the app, direct ordering, and Pizza Pizza Club integration positions it well, but execution must keep pace with rising consumer expectations for speed and convenience.' },
    { titleTemplate: () => 'Canadian QSR Foot Traffic Stabilizes But Shifts to Value-Led and Convenience-First Brands', tags: ['macro'], urgency: 'medium', summary: 'QSR foot traffic data shows overall visits have stabilized after two years of shifting patterns, but traffic is redistributing toward value-led and convenience-first brands. Pizza and burger chains are among the beneficiaries, while premium fast-casual concepts continue to lose share of visits.', whyItMatters: 'Foot traffic stabilization with a shift toward value-led QSR is a positive signal for Pizza Pizza\'s model. The value-and-convenience positioning is exactly the kind of everyday QSR that is capturing redirected traffic from full-service and premium fast-casual.' },

    // ── Loop articles (recycled across dates) ──
    // Brand loop
    { titleTemplate: () => 'Pizza Pizza Brand Sentiment Surges After Viral TikTok Showing 30-Minute Delivery Challenge', tags: ['brand'], urgency: 'medium', summary: 'A TikTok video showing a Pizza Pizza delivery arriving in under 30 minutes during a snowstorm went viral, generating 1.2M views and shifting brand sentiment measurably positive across social platforms. The organic moment reinforced Pizza Pizza\'s delivery reliability with younger audiences.', whyItMatters: 'Viral delivery moments are high-value brand signals — they validate Pizza Pizza\'s operational excellence and generate organic reach that paid media should amplify before the moment fades.' },
    { titleTemplate: () => 'Pizza Pizza Opens 15 New Locations Across Suburban Ontario and Western Canada', tags: ['brand'], urgency: 'medium', summary: 'Pizza Pizza has opened 15 new locations across suburban Ontario and Western Canada markets, featuring updated store designs with digital ordering kiosks and expanded delivery zones. The expansion targets underserved markets with strong local demand for value QSR.', whyItMatters: 'New store openings signal confidence in the expansion model and extend Pizza Pizza\'s delivery radius. Each opening is an opportunity to generate local media coverage and geo-targeted marketing to build awareness in new markets.' },
    { titleTemplate: () => 'Pizza Pizza Partners with NHL Team for Exclusive Game Day Combo — Sells Out Opening Night', tags: ['brand'], urgency: 'high', summary: 'Pizza Pizza\'s exclusive NHL team partnership featuring a limited-edition game day combo sold out at arena locations on opening night. The partnership included co-branded packaging, social media activations, and in-arena promotions, generating significant social buzz and media coverage.', whyItMatters: 'Exclusive sports partnerships reinforce Pizza Pizza\'s cultural relevance and create urgency-driven purchase moments that competitors cannot replicate. The sell-through velocity validates the sports marketing strategy.' },

    // QSR loop
    { titleTemplate: () => 'Canadian Independent QSR Operators Report 22% Revenue Growth — Pizza Category Leads', tags: ['qsr'], urgency: 'medium', summary: 'Canadian independent QSR operators report 22% revenue growth driven by pizza and burger categories. The growth is attributed to social media marketing, delivery platform presence, and renewed consumer interest in local and Canadian-owned brands.', whyItMatters: 'Independent QSR growth signals a competitive landscape where Pizza Pizza must differentiate on scale, consistency, and digital ordering capabilities while maintaining its Canadian-brand identity advantage.' },
    { titleTemplate: () => 'Ghost Kitchen Model Expands Across Canadian QSR — Delivery-Only Brands Gain Market Share', tags: ['qsr'], urgency: 'low', summary: 'Industry data shows ghost kitchen concepts have expanded rapidly across Canadian QSR, with delivery-only pizza brands gaining meaningful market share. The model offers lower overhead but lacks the brand presence and customer experience of established chains.', whyItMatters: 'Ghost kitchen expansion creates new competitive pressure for Pizza Pizza on delivery platforms. The advantage of physical locations, brand recognition, and customer trust should be emphasized — delivery-only brands compete on price but cannot match the full experience.' },
    { titleTemplate: () => 'Restaurants Canada Reports Pizza as Most-Ordered QSR Category for Third Year Running', tags: ['qsr'], urgency: 'medium', summary: 'Restaurants Canada reports pizza remains the most-ordered QSR category for the third consecutive year, with order volume up 12% and revenue up 15%. Family meal bundles, delivery orders, and late-night purchasing are driving the growth.', whyItMatters: 'Sustained pizza category leadership validates Pizza Pizza\'s core business. The brand should lean into category-level messaging that positions Pizza Pizza as the definitive Canadian pizza destination.' },

    // Menu loop
    { titleTemplate: () => 'Spicy and Global Flavour Profiles Emerge as TikTok-Driven Pizza Trend', tags: ['menu'], urgency: 'medium', summary: 'A new trend of spicy and global-flavour pizza combinations is emerging rapidly on TikTok, with Korean gochujang, Nashville hot chicken, and mango habanero toppings gaining traction. The trend is attracting younger consumers who want adventurous flavours, and related videos are generating millions of views.', whyItMatters: 'Emerging flavour trends caught early give Pizza Pizza a menu innovation advantage. Spicy and global flavours align with the younger demographic\'s taste preferences — an opportunity for limited-time offers and social media-driven launches.' },
    { titleTemplate: () => 'Breakfast Pizza Sees Unexpected Demand Surge — QSR Chains Report Morning Daypart Growth', tags: ['menu'], urgency: 'medium', summary: 'Breakfast pizza is experiencing unexpected demand growth, driven by QSR chains adding morning daypart options. Sales data shows 30% month-over-month growth in breakfast pizza items, with the trend strongest among 25-44 consumers.', whyItMatters: 'Breakfast pizza demand growth could unlock a new daypart for Pizza Pizza. Morning pizza represents incremental revenue with minimal operational complexity — the ovens are already hot.' },
    { titleTemplate: () => 'Pizza Subscription Models Gain Traction — "Unlimited Slice" and Monthly Plans Fragment the Market', tags: ['menu'], urgency: 'low', summary: 'Pizza subscription models are fragmenting the market, with "unlimited slice" programs and monthly pizza plans gaining traction among frequent orderers. Early data shows subscribers order 3.2x more frequently than non-subscribers.', whyItMatters: 'Subscription models create competitive pressure by locking in customer frequency. Pizza Pizza should evaluate whether a subscription tier within the Pizza Pizza Club loyalty program could capture this demand and increase order frequency.' },

    // Delivery loop
    { titleTemplate: () => 'UberEats Reports Pizza Bundle Orders Surge 52% — Combo Deals and Family Packs Leading', tags: ['delivery'], urgency: 'high', summary: 'UberEats Canada reports pizza bundle orders are up 52% year-over-year, with combo deals and family-size bundles among the fastest-growing order types. Data shows group ordering intent drives 78% of bundle purchases.', whyItMatters: 'Delivery platform data proving demand for pizza bundles validates Pizza Pizza\'s family meal deal strategy. Pizza Pizza can differentiate with better value and larger bundle options than competitors offer on aggregator platforms.' },
    { titleTemplate: () => 'DoorDash Order Velocity Spikes for Three Regional Pizza Chains — Breakout Signals Emerging', tags: ['delivery'], urgency: 'medium', summary: 'Three regional pizza chains have shown rapid order volume growth on DoorDash over the past two weeks, with orders growing 5-8x faster than comparable chains. The pattern typically precedes mainstream expansion by 4-6 weeks.', whyItMatters: 'Order velocity spikes on delivery platforms are leading indicators of competitive threats. Pizza Pizza should monitor these chains\' expansion plans and marketing strategies to maintain delivery market share.' },
    { titleTemplate: () => 'SkipTheDishes Late-Night Pizza Orders Surge 38% — 10PM-2AM Window Fastest-Growing Daypart', tags: ['delivery'], urgency: 'medium', summary: 'SkipTheDishes data shows late-night pizza orders (10PM-2AM) are up 38%, making it the fastest-growing daypart on the platform. Student areas and downtown cores are driving the growth, with average order values 22% higher than daytime orders.', whyItMatters: 'Late-night delivery demand confirms the strategic importance of Pizza Pizza\'s Late Night Cravings campaign. Extended hours and fast delivery in high-demand zones are competitive advantages worth amplifying in marketing.' },

    // Social loop
    { titleTemplate: () => 'r/pizza "Pizza Hack" Posts Drive Order Experimentation — Custom Toppings and Secret Menu Items', tags: ['social'], urgency: 'medium', summary: 'The r/pizza community\'s popular "pizza hack" and "secret menu" posts are driving order experimentation, with users creating custom topping combinations and sharing results. Multiple posts reference Pizza Pizza\'s customization options as ideal for hack experiments.', whyItMatters: 'The "pizza hack" trend is a natural fit for Pizza Pizza\'s customizable menu. Marketing should lean into the experimentation angle — encourage UGC content showing creative custom orders to drive engagement and repeat visits.' },
    { titleTemplate: () => 'r/foodToronto Grows to 280K Members — Pizza Remains Most-Discussed QSR Category', tags: ['social'], urgency: 'low', summary: 'Reddit\'s r/foodToronto community has grown to 280K members, with pizza consistently the most-discussed QSR category. The community\'s recommendations increasingly influence ordering decisions among engaged food enthusiasts in the GTA.', whyItMatters: 'Reddit food communities surface high-conviction opinions — Pizza Pizza\'s presence in these conversations builds organic credibility with a key demographic. Monitor for sentiment shifts and competitive mentions.' },
    { titleTemplate: () => 'TikTok #PizzaReview Trend Drives 340% Spike in User-Generated Pizza Content', tags: ['social'], urgency: 'medium', summary: 'The TikTok #PizzaReview trend has driven a 340% spike in user-generated pizza content, with creators reviewing slices from various chains and rating them on camera. The trend is reshaping how younger consumers discover and choose pizza brands.', whyItMatters: 'TikTok pizza reviews are becoming a primary discovery channel for younger consumers. Pizza Pizza should encourage and amplify positive UGC reviews and consider creator partnerships to ensure strong representation in the trend.' },

    // Sports loop
    { titleTemplate: () => 'March Madness and NHL Playoffs Drive Catering Order Surge — Office and Watch Party Bundles Spike', tags: ['sports'], urgency: 'medium', summary: 'Google Trends data shows sports event catering searches are starting 2 weeks earlier than last year, with "pizza for watch party," "game day catering," and "office pizza order" among the fastest-growing queries. Search intent is shifting toward group and party-size orders.', whyItMatters: 'Earlier search intent for sports catering means earlier marketing activation. Pizza Pizza should launch sports season catering campaigns now rather than waiting for the traditional window — the demand curve has shifted.' },
    { titleTemplate: () => 'Sports Sponsorship ROI for QSR Brands Reaches All-Time High — 28% Lift in Brand Recall', tags: ['sports'], urgency: 'medium', summary: 'Marketing analytics show QSR brands with active sports sponsorships are seeing a 28% lift in brand recall and 18% higher order frequency among fans. Arena naming rights, team partnerships, and in-game promotions are the highest-ROI activation types.', whyItMatters: 'Sports sponsorship ROI at all-time highs validates Pizza Pizza\'s investment in sports marketing. Increasing sports partnership spend could unlock disproportionate brand recall and order frequency gains among key demographics.' },
    { titleTemplate: () => 'FIFA World Cup 2026 Pizza Demand Forecast — Canadian Host Cities Expected to See 5x Order Spikes', tags: ['sports'], urgency: 'medium', summary: 'The upcoming FIFA World Cup 2026 in Canadian host cities is forecast to drive 5x pizza order spikes during match windows. QSR brands are already planning expanded delivery capacity, temporary locations near venues, and co-branded promotions.', whyItMatters: 'The World Cup represents a once-in-a-generation demand event for Pizza Pizza in Canadian host cities. Early planning for delivery capacity, promotional strategy, and venue presence will determine share of the incremental demand.' },

    // Sponsorships loop
    { titleTemplate: () => 'Maple Leafs Star Signs Extension — Fan Engagement Peaks as Jersey Sales Break Records', tags: ['sponsorships'], urgency: 'medium', summary: 'A Maple Leafs star player has signed a long-term contract extension, sending fan engagement metrics to season highs. Jersey sales broke single-day records and social media mentions of the Leafs spiked 420% in the 24 hours following the announcement. The moment generated significant organic content from fans celebrating across Toronto.', whyItMatters: 'High-emotion fan moments are the most valuable activation windows for corporate sponsors. Pizza Pizza should consider real-time social content tied to the signing, limited-time promotional offers referencing the player\'s number, and push notifications to loyalty app users in the GTA.' },
    { titleTemplate: () => 'PWHL Toronto Announces Community Arena Tour — Grassroots Fan Events Across Ontario This Summer', tags: ['sponsorships'], urgency: 'medium', summary: 'PWHL Toronto has announced a summer community arena tour visiting 12 Ontario cities, featuring player appearances, youth clinics, and fan activations. The tour is designed to build grassroots support and expand the league\'s fanbase beyond downtown Toronto into suburban and regional markets.', whyItMatters: 'The community tour aligns perfectly with Pizza Pizza\'s Ontario footprint. Co-branded activations at each stop — sampling, app download incentives, and social content — would extend the sponsorship\'s reach into markets where Pizza Pizza is actively expanding.' },
    { titleTemplate: () => 'BC Lions and CFL Announce Expanded Grey Cup Week Programming — Week-Long Fan Festival Planned', tags: ['sponsorships'], urgency: 'medium', summary: 'The CFL has announced expanded Grey Cup Week programming with a week-long fan festival in the host city. The BC Lions are expected to be contenders, and early projections show record attendance and media coverage for the event. Corporate sponsors will have expanded activation opportunities across the festival grounds.', whyItMatters: 'Grey Cup Week is the CFL\'s marquee event and the highest-visibility moment for Pizza Pizza\'s league sponsorship. Early planning for on-site activations, delivery promotions in the host city, and co-branded content will maximise ROI from the expanded festival format.' },

    // Competitors loop
    { titleTemplate: () => 'Domino\'s Tests 15-Minute Delivery Guarantee in Toronto — Puts Pressure on Delivery Speed Standards', tags: ['competitors'], urgency: 'medium', competitor: 'Domino\'s', summary: 'Domino\'s is piloting a 15-minute delivery guarantee in select Toronto zones, offering a discount if the order arrives late. The test is supported by investment in delivery infrastructure and route optimisation technology. Industry analysts note this could reset consumer expectations for delivery speed across the QSR pizza category.', whyItMatters: 'If Domino\'s 15-minute guarantee gains traction, it raises the delivery speed bar for all competitors. Pizza Pizza should monitor customer feedback in overlapping zones and evaluate whether operational adjustments are needed to maintain its delivery speed advantage.' },
    { titleTemplate: () => 'Pizza Nova Launches "Toppings Bar" Concept — In-Store Customisation Targeting Gen Z', tags: ['competitors'], urgency: 'medium', competitor: 'Pizza Nova', summary: 'Pizza Nova has launched a "Toppings Bar" concept in select GTA locations, allowing customers to build custom pizzas from a visible fresh-ingredient display. The concept is designed to appeal to Gen Z\'s desire for customisation and transparency, with social media content showing the build process generating strong engagement.', whyItMatters: 'Pizza Nova\'s Toppings Bar targets the customisation and transparency trends that resonate with younger consumers. Pizza Pizza should assess whether this experience-driven concept is shifting foot traffic or brand perception among the Gen Z segment in overlapping markets.' },
    { titleTemplate: () => 'Pizza Hut Partners with DoorDash for Exclusive Bundle Deals — Platform-First Strategy Intensifies', tags: ['competitors'], urgency: 'medium', competitor: 'Pizza Hut', summary: 'Pizza Hut has announced an exclusive partnership with DoorDash offering bundle deals available only through the platform, including family meal combos at 20% below in-store pricing. The strategy prioritises delivery platform visibility over direct ordering, a sharp contrast to competitors investing in first-party apps.', whyItMatters: 'Pizza Hut\'s platform-first strategy is the opposite of Pizza Pizza\'s direct-ordering approach. While it may drive short-term volume, the 25-30% commission structure erodes margins. This validates Pizza Pizza\'s investment in the loyalty app and direct ordering — worth emphasising in marketing to value-conscious consumers.' },

    // Macro loop
    { titleTemplate: () => 'Holiday Spending Forecast Cautious — Canadians Plan to Spend 8% Less on Dining Out', tags: ['macro'], urgency: 'high', summary: 'Early holiday spending forecasts show Canadian consumers planning to reduce dining-out spending by 8% compared to last year. However, spending on "convenient" and "value" food options is expected to hold steady, suggesting a trade-down from full-service restaurants rather than across-the-board cuts.', whyItMatters: 'A value-seeking environment favours Pizza Pizza over premium dining competitors. Marketing should emphasize value, convenience, and family-friendly pricing rather than competing on premium experiences.' },
    { titleTemplate: () => 'Inflation Sensitivity Rises for Food-Away-From-Home — But QSR Pizza Spending Remains Resilient', tags: ['macro'], urgency: 'medium', summary: 'Statistics Canada data shows rising inflation sensitivity across food-away-from-home categories, but QSR pizza spending has remained resilient, declining only 2% compared to 8-12% drops in casual dining and fine dining. Pizza appears to benefit from its positioning as affordable comfort food.', whyItMatters: 'QSR pizza spending resilience is Pizza Pizza\'s anchor in a challenging environment. The "affordable comfort food" positioning should be emphasized in marketing — pizza as everyday value, especially relative to other dining categories.' },
    { titleTemplate: () => 'Canadian Convenience Expectations Rise — 82% of QSR Customers Expect Sub-30-Minute Delivery', tags: ['macro'], urgency: 'medium', summary: 'A Deloitte Canada study finds 82% of Canadian QSR customers now expect sub-30-minute delivery, up from 64% two years ago. Chains without competitive delivery speed are losing share to faster competitors and aggregator platforms.', whyItMatters: 'Rising delivery speed expectations put pressure on all QSR operators. Pizza Pizza\'s own delivery fleet and established delivery infrastructure are competitive advantages — marketing should frame speed as a core brand promise.' },
  ];

  // First 21 templates are pinned (3 per category x 7 categories), rest are loop templates
  const pinnedTemplates = templates.slice(0, 21);
  const loopTemplates = templates.slice(21);

  const categoryTags: NewsTag[] = ['brand', 'qsr', 'menu', 'delivery', 'social', 'sports', 'sponsorships', 'competitors', 'macro'];
  const categorySources: Record<string, string[][]> = {
    brand: [['Retail Insider', 'Financial Post', 'Strategy Online']],
    qsr: [['QSR Magazine', 'Technomic', 'Restaurants Canada']],
    menu: [['Technomic', 'QSR Magazine', 'Food in Canada']],
    delivery: [['UberEats Data', 'DoorDash Insights', 'SkipTheDishes Analytics']],
    social: [['Reddit r/pizza', 'Reddit r/foodToronto', 'TikTok #FoodTok']],
    sports: [['TSN', 'Sportsnet', 'Strategy Online']],
    sponsorships: [['TSN', 'Sportsnet', 'The Athletic']],
    competitors: [['Retail Insider', 'QSR Magazine', 'RedFlagDeals']],
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
      campaign: 'pp-loyalty-app',
      channels: ['instagram', 'facebook', 'tiktok'],
      title: 'Pacing to Underspend',
      recommendedAction: 'Increase daily budget or expand targeting to hit flight budget',
      summary: 'Loyalty App Acquisition daily spend rate projects a $38K underspend by flight end. Expanding app-install lookalike audiences or increasing bid caps will close the gap before the spring app acquisition push.',
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
      campaign: 'pp-game-day',
      channels: ['google-search', 'instagram'],
      title: 'CPA Trending Above Target',
      recommendedAction: 'Tighten targeting or reduce bid caps on broad search terms',
      summary: 'Game Day & Sports Moments cost per conversion has risen 18% above target. Generic pizza search terms are driving inefficiency compared to branded Pizza Pizza queries.',
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
      summary: 'Instagram is receiving 40% of total budget but generating only 18% of conversions. Google Search shows 3.2x higher ROAS with room to scale for delivery and pickup orders.',
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
      summary: 'Incremental CPA on Facebook has risen 35% as audience overlap between ad sets reaches 45%. Moving $5K weekly to Search would improve blended efficiency heading into the spring ordering season.',
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
      summary: 'Users are seeing Pizza Pizza ads an average of 12.4 times per week across channels, well above the 8x optimal threshold. Excess frequency is driving CPM inflation without conversion lift.',
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
      campaign: 'pp-tiktok-foodies',
      channels: ['instagram', 'tiktok'],
      title: 'Possible Creative Fatigue',
      recommendedAction: 'Refresh TikTok Foodies creative with new food content and UGC-style variants',
      summary: 'Primary TikTok Foodies creative has been running for 21 days with CTR declining steadily. Frequency has reached 6.8x in the core 18-34 foodie audience, indicating ad fatigue.',
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
      campaign: 'pp-loyalty-app',
      channels: ['instagram', 'tiktok'],
      title: 'Possible Creative Fatigue',
      recommendedAction: 'Pause spend on underperforming ad',
      summary: 'Loyalty app download promo video has reached saturation with completion rates dropping below 15%. The Pizza Pizza Club value audience has been heavily exposed over the past 3 weeks.',
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
      campaign: 'pp-family-deals',
      channels: ['instagram', 'tiktok'],
      title: 'Possible Creative Fatigue',
      recommendedAction: 'Pause spend on underperforming ad',
      summary: 'Family meal deal carousel in Family Meal Deals campaign shows declining engagement. Swipe rate has halved while CPC has doubled, suggesting creative exhaustion.',
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
      campaign: 'pp-loyalty-app',
      channels: ['tiktok', 'instagram'],
      title: 'Top Performer Ready to Scale',
      recommendedAction: 'Increase budget allocation to top creative',
      summary: 'New UGC-style Pizza Pizza Club member testimonial video is outperforming all other creatives by 2.4x on ROAS. Currently capped at 15% of ad set budget — scaling to 35% is projected to improve overall campaign ROAS.',
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
      campaign: 'pp-new-menu',
      channels: ['facebook', 'instagram'],
      title: 'Low Engagement Variant',
      recommendedAction: 'Replace or refresh underperforming creative',
      summary: 'Static new menu item image variant C has the lowest engagement rate across all active creatives at 0.8%. Budget is being wasted on an asset that fails to capture attention in the New Menu Launch campaign.',
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
      campaign: 'pp-loyalty-app',
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
