import { subDays, format } from 'date-fns';
import type {
  ChannelId, Campaign, CampaignObjective, CampaignStatus,
  DailyMetrics, AggregatedKPIs, KPIDelta, KPIKey,
  NewsItem, NewsTag, NewsUrgency,
  Insight, InsightCategory, InsightStatus, InsightActionStep,
  Anomaly,
  DivisionId, AgencyId, ProductLineId, AudienceId, GeoId,
} from '@/types';
import { CHANNEL_LABELS, GEO_LABELS } from '@/types';

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
const ALL_GEOS: GeoId[] = ['national', 'ontario', 'quebec', 'western', 'atlantic'];
const ALL_CHANNELS: ChannelId[] = ['instagram', 'facebook', 'tiktok', 'google-search', 'ttd', 'ctv', 'spotify', 'linkedin', 'ooh'];

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
  'google-search': { baseSpend: 2085, cpmRange: [18, 38], ctrRange: [3, 7],    cvrRange: [0.36, 0.84], cpcRange: [3, 7],   videoViewRate: 0, videoCompletionRate: 0, engagementMultiplier: 0.5, volatility: 0.15 },
  'facebook':      { baseSpend: 1730, cpmRange: [10, 22], ctrRange: [0.9, 2.0], cvrRange: [0.24, 0.56], cpcRange: [1.2, 3.5], videoViewRate: 0.3, videoCompletionRate: 0.25, engagementMultiplier: 1.2, volatility: 0.12 },
  'instagram':     { baseSpend: 1535, cpmRange: [10, 24], ctrRange: [0.8, 1.8], cvrRange: [0.21, 0.49], cpcRange: [1.5, 4],   videoViewRate: 0.4, videoCompletionRate: 0.3, engagementMultiplier: 1.5, volatility: 0.1 },
  'tiktok':        { baseSpend: 1185, cpmRange: [6, 18],  ctrRange: [0.6, 1.6], cvrRange: [0.15, 0.35], cpcRange: [0.8, 2.5], videoViewRate: 0.8, videoCompletionRate: 0.15, engagementMultiplier: 2.0, volatility: 0.25 },
  'ttd':           { baseSpend: 2570, cpmRange: [6, 18],  ctrRange: [0.2, 0.8], cvrRange: [0.30, 0.70], cpcRange: [1.5, 5],   videoViewRate: 0.2, videoCompletionRate: 0.2, engagementMultiplier: 0.3, volatility: 0.08 },
  'ctv':           { baseSpend: 3200, cpmRange: [22, 45], ctrRange: [0.15, 0.5],cvrRange: [0.09, 0.21], cpcRange: [4, 10],    videoViewRate: 0.9, videoCompletionRate: 0.7, engagementMultiplier: 0.2, volatility: 0.06 },
  'spotify':       { baseSpend: 1400, cpmRange: [12, 28], ctrRange: [0.4, 1.2], cvrRange: [0.09, 0.21], cpcRange: [2, 5],     videoViewRate: 0.0, videoCompletionRate: 0.0, engagementMultiplier: 0.4, volatility: 0.10 },
  'linkedin':      { baseSpend: 1800, cpmRange: [15, 35], ctrRange: [0.5, 1.5], cvrRange: [0.36, 0.84], cpcRange: [3, 8],     videoViewRate: 0.15, videoCompletionRate: 0.2, engagementMultiplier: 0.6, volatility: 0.10 },
  'ooh':           { baseSpend: 2200, cpmRange: [8, 20],  ctrRange: [0.1, 0.3], cvrRange: [0.048, 0.112], cpcRange: [5, 15],  videoViewRate: 0, videoCompletionRate: 0, engagementMultiplier: 0.1, volatility: 0.05 },
};

// ===== Geo multipliers =====
const GEO_MULTIPLIERS: Record<GeoId, number> = {
  'national': 1.4,
  'ontario': 1.3,
  'quebec': 1.1,
  'western': 1.2,
  'atlantic': 0.9,
};

// ===== State Branch Weight Distribution (Chase branches, approximate) =====
const PROVINCE_BRANCH_WEIGHT: Record<string, number> = {
  'CA': 0.180, 'TX': 0.140, 'NY': 0.120, 'FL': 0.090, 'IL': 0.070,
  'NJ': 0.050, 'AZ': 0.040, 'OH': 0.040, 'MI': 0.030, 'WA': 0.030,
  'PA': 0.030, 'GA': 0.030, 'NC': 0.030, 'CO': 0.020, 'VA': 0.020,
  'MA': 0.020, 'CT': 0.020, 'OR': 0.015, 'NV': 0.015, 'IN': 0.010,
};

// ===== Geo region → US states mapping =====
const GEO_TO_PROVINCES: Record<GeoId, string[]> = {
  'national': ['CA', 'TX', 'NY', 'FL', 'IL', 'NJ', 'AZ', 'OH', 'MI', 'WA', 'PA', 'GA', 'NC', 'CO', 'VA', 'MA', 'CT', 'OR', 'NV', 'IN'],
  'ontario': ['NY', 'NJ', 'PA', 'CT', 'MA'],     // Northeast
  'quebec': ['FL', 'GA', 'NC', 'SC', 'VA'],      // Southeast
  'western': ['CA', 'OR', 'WA', 'NV', 'AZ'],     // West
  'atlantic': ['IL', 'OH', 'MI', 'IN', 'TX'],    // Midwest + TX
};

// ===== Campaign definitions =====
interface CampaignDef {
  id: string; name: string; division: DivisionId; agency: AgencyId;
  productLine: ProductLineId; audiences: AudienceId[];
  objective: CampaignObjective; status: CampaignStatus;
  channels: ChannelId[]; geos: GeoId[]; budgetMultiplier: number;
  plannedBudget: number;
  revPerConvRange: [number, number];
  cvrModifier: number;
  revTrend: number;
}

const CAMPAIGN_DEFS: CampaignDef[] = [
  { id: 'rbc-avion-travel-q1', name: 'Sapphire Travel Rewards — Q1 Push', division: 'pcb', agency: 'omnicom', productLine: 'avion', audiences: ['young-professionals', 'families', 'high-net-worth'], objective: 'awareness', status: 'live',
    channels: ['instagram', 'facebook', 'google-search', 'ctv', 'ttd', 'ooh', 'spotify'], geos: ['national'], budgetMultiplier: 1.50, plannedBudget: 3200000, revPerConvRange: [1400, 2200], cvrModifier: 1.0, revTrend: 0.0002 },
  { id: 'rbc-avion-points-accel', name: 'Sapphire Points Accelerator', division: 'pcb', agency: 'omnicom', productLine: 'avion', audiences: ['young-professionals', 'families', 'mass-market'], objective: 'conversion', status: 'live',
    channels: ['instagram', 'facebook', 'google-search'], geos: ['national'], budgetMultiplier: 1.10, plannedBudget: 1800000, revPerConvRange: [1200, 1800], cvrModifier: 1.15, revTrend: 0.0003 },
  { id: 'rbc-avion-retention', name: 'Sapphire Cardholder Retention', division: 'pcb', agency: 'omnicom', productLine: 'avion', audiences: ['young-professionals', 'families', 'high-net-worth'], objective: 'retention', status: 'live',
    channels: ['instagram', 'facebook', 'google-search'], geos: ['national'], budgetMultiplier: 0.85, plannedBudget: 1200000, revPerConvRange: [1600, 2400], cvrModifier: 1.2, revTrend: 0.0004 },
  { id: 'rbc-ion-launch', name: 'Freedom Card Digital Launch', division: 'pcb', agency: 'omnicom', productLine: 'ion', audiences: ['young-professionals', 'students'], objective: 'awareness', status: 'live',
    channels: ['tiktok', 'instagram', 'facebook', 'spotify', 'google-search'], geos: ['national'], budgetMultiplier: 1.35, plannedBudget: 2400000, revPerConvRange: [600, 1000], cvrModifier: 0.7, revTrend: 0.0001 },
  { id: 'rbc-ion-student', name: 'Freedom Student Crossover', division: 'pcb', agency: 'omnicom', productLine: 'ion', audiences: ['students'], objective: 'consideration', status: 'live',
    channels: ['tiktok', 'instagram', 'facebook', 'spotify'], geos: ['ontario', 'quebec'], budgetMultiplier: 0.70, plannedBudget: 900000, revPerConvRange: [400, 700], cvrModifier: 0.75, revTrend: -0.0002 },
  { id: 'rbc-rewards-awareness', name: 'Ultimate Rewards Brand Awareness', division: 'pcb', agency: 'in-house', productLine: 'rewards', audiences: ['mass-market', 'young-professionals', 'families'], objective: 'awareness', status: 'live',
    channels: ['instagram', 'facebook', 'ctv', 'spotify'], geos: ['national'], budgetMultiplier: 1.00, plannedBudget: 1600000, revPerConvRange: [800, 1200], cvrModifier: 0.85, revTrend: 0 },
  { id: 'rbc-mortgage-spring', name: 'Spring Mortgage Rates', division: 'pcb', agency: 'omnicom', productLine: 'mortgage', audiences: ['families', 'young-professionals'], objective: 'conversion', status: 'live',
    channels: ['google-search', 'instagram', 'facebook', 'ctv', 'ttd'], geos: ['national'], budgetMultiplier: 1.40, plannedBudget: 2800000, revPerConvRange: [2800, 4500], cvrModifier: 1.15, revTrend: 0.0008 },
  { id: 'rbc-mortgage-ftb', name: 'First-Time Home Buyer', division: 'pcb', agency: 'omnicom', productLine: 'mortgage', audiences: ['young-professionals'], objective: 'consideration', status: 'live',
    channels: ['google-search', 'instagram', 'facebook', 'linkedin'], geos: ['ontario', 'western'], budgetMultiplier: 1.05, plannedBudget: 1500000, revPerConvRange: [2200, 3500], cvrModifier: 1.0, revTrend: 0.0005 },
  { id: 'rbc-di-tfsa', name: 'Roth IRA Season Push', division: 'wealth', agency: 'publicis', productLine: 'direct-investing', audiences: ['young-professionals', 'high-net-worth', 'retirees'], objective: 'conversion', status: 'live',
    channels: ['google-search', 'instagram', 'facebook', 'linkedin'], geos: ['national'], budgetMultiplier: 1.20, plannedBudget: 2000000, revPerConvRange: [1800, 3000], cvrModifier: 1.1, revTrend: 0.0005 },
  { id: 'rbc-di-active-trader', name: 'Active Trader Acquisition', division: 'wealth', agency: 'publicis', productLine: 'direct-investing', audiences: ['young-professionals', 'high-net-worth'], objective: 'consideration', status: 'live',
    channels: ['google-search', 'instagram', 'facebook', 'tiktok'], geos: ['national'], budgetMultiplier: 0.90, plannedBudget: 1100000, revPerConvRange: [2500, 4000], cvrModifier: 1.0, revTrend: 0.0006 },
  { id: 'rbc-ds-hnw', name: 'HNW Wealth Advisory', division: 'wealth', agency: 'publicis', productLine: 'dominion-securities', audiences: ['high-net-worth', 'retirees'], objective: 'consideration', status: 'live',
    channels: ['linkedin', 'ctv', 'ooh'], geos: ['ontario', 'western'], budgetMultiplier: 1.15, plannedBudget: 1800000, revPerConvRange: [4000, 8000], cvrModifier: 0.9, revTrend: 0.0006 },
  { id: 'rbc-insurance-bundle', name: 'Home & Auto Insurance Bundle', division: 'insurance', agency: 'publicis', productLine: 'insurance-products', audiences: ['families', 'mass-market'], objective: 'conversion', status: 'live',
    channels: ['google-search', 'instagram', 'facebook', 'ctv'], geos: ['national'], budgetMultiplier: 1.25, plannedBudget: 2100000, revPerConvRange: [1000, 1600], cvrModifier: 1.1, revTrend: 0.0002 },
  { id: 'rbc-student-bts', name: 'Back to School Banking 2026', division: 'pcb', agency: 'omnicom', productLine: 'student', audiences: ['students'], objective: 'awareness', status: 'live',
    channels: ['tiktok', 'instagram', 'facebook', 'spotify'], geos: ['ontario', 'quebec'], budgetMultiplier: 0.65, plannedBudget: 800000, revPerConvRange: [200, 400], cvrModifier: 0.7, revTrend: -0.0003 },
  { id: 'rbc-newcomer-welcome', name: 'Welcome to America', division: 'pcb', agency: 'wpp', productLine: 'newcomer', audiences: ['new-canadians'], objective: 'awareness', status: 'live',
    channels: ['google-search', 'instagram', 'facebook', 'linkedin'], geos: ['national'], budgetMultiplier: 1.00, plannedBudget: 1400000, revPerConvRange: [500, 900], cvrModifier: 0.85, revTrend: 0.0001 },
  { id: 'rbc-smb-growth', name: 'Small Business Growth', division: 'pcb', agency: 'wpp', productLine: 'small-business', audiences: ['business-owners'], objective: 'consideration', status: 'live',
    channels: ['google-search', 'linkedin', 'instagram', 'facebook'], geos: ['national'], budgetMultiplier: 1.10, plannedBudget: 1600000, revPerConvRange: [2000, 3500], cvrModifier: 1.0, revTrend: 0.0003 },
  { id: 'rbc-cml-commercial', name: 'Commercial Lending', division: 'capital-markets', agency: 'wpp', productLine: 'commercial-lending', audiences: ['business-owners'], objective: 'consideration', status: 'live',
    channels: ['linkedin', 'google-search'], geos: ['national'], budgetMultiplier: 0.75, plannedBudget: 900000, revPerConvRange: [5000, 10000], cvrModifier: 0.85, revTrend: 0.0004 },
  { id: 'rbc-gic-rates', name: 'CD Rate Promotion', division: 'pcb', agency: 'in-house', productLine: 'gic-savings', audiences: ['retirees', 'mass-market'], objective: 'conversion', status: 'live',
    channels: ['google-search', 'instagram', 'facebook'], geos: ['national'], budgetMultiplier: 0.80, plannedBudget: 1000000, revPerConvRange: [600, 1000], cvrModifier: 1.1, revTrend: -0.0006 },
  { id: 'rbc-gameday-moments', name: 'Game Day Moments', division: 'pcb', agency: 'in-house', productLine: 'rewards', audiences: ['young-professionals', 'families', 'mass-market'], objective: 'awareness', status: 'live',
    channels: ['instagram', 'facebook', 'ctv', 'tiktok', 'ooh', 'spotify'], geos: ['national'], budgetMultiplier: 1.60, plannedBudget: 3500000, revPerConvRange: [400, 700], cvrModifier: 0.85, revTrend: -0.0002 },
  { id: 'rbc-brand-q1', name: 'Chase Master Brand — Q1', division: 'pcb', agency: 'in-house', productLine: 'rewards', audiences: ['mass-market', 'young-professionals', 'families'], objective: 'awareness', status: 'live',
    channels: ['instagram', 'facebook', 'ctv', 'google-search', 'ooh', 'spotify'], geos: ['national'], budgetMultiplier: 1.75, plannedBudget: 4000000, revPerConvRange: [300, 500], cvrModifier: 0.8, revTrend: -0.0004 },
];

// ===== Events (anomaly generators) =====
interface DataEvent {
  name: string; dayOffset: number; duration: number;
  geos: GeoId[]; spendMult: number; cvrMult: number; engageMult: number;
}

const DATA_EVENTS: DataEvent[] = [
  { name: 'IRA/401(k) Deadline Push', dayOffset: 30, duration: 14, geos: ['national'], spendMult: 1.6, cvrMult: 1.4, engageMult: 1.2 },
  { name: 'Federal Reserve Rate Decision', dayOffset: 60, duration: 5, geos: ['national'], spendMult: 1.3, cvrMult: 1.2, engageMult: 1.1 },
  { name: 'Spring Housing Market Surge', dayOffset: 90, duration: 21, geos: ['national'], spendMult: 1.5, cvrMult: 1.3, engageMult: 1.0 },
  { name: 'Robinhood Aggressive Campaign', dayOffset: 110, duration: 10, geos: ['national'], spendMult: 1.0, cvrMult: 0.85, engageMult: 0.8 },
  { name: 'Back to School Banking Season', dayOffset: 150, duration: 14, geos: ['national'], spendMult: 1.4, cvrMult: 1.15, engageMult: 1.3 },
];

// ===== Data Generation =====
function generateDailyData(): Record<string, Record<string, DailyMetrics[]>> {
  const data: Record<string, Record<string, DailyMetrics[]>> = {};

  for (const campaign of CAMPAIGN_DEFS) {
    data[campaign.id] = {};
    // Use the first geo's multiplier as the campaign multiplier
    const geoMult = GEO_MULTIPLIERS[campaign.geos[0]] || 1.0;

    for (const channel of campaign.channels) {
      const profile = CHANNEL_PROFILES[channel];
      const days: DailyMetrics[] = [];

      for (let d = 0; d < DATA_DAYS; d++) {
        const date = format(subDays(END_DATE, DATA_DAYS - 1 - d), 'yyyy-MM-dd');
        const dayOfWeek = new Date(date).getDay();
        const weekendMult = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.75 : 1.0;
        const seasonality = 1 + 0.03 * Math.sin((d / DATA_DAYS) * Math.PI * 4); // gentle ripple, 2 cycles
        const growthTrend = 0.88 + (d / DATA_DAYS) * 0.24; // starts lower, ends higher — clear upward trajectory

        // Check events
        let eventSpendMult = 1, eventCvrMult = 1, eventEngageMult = 1;
        for (const evt of DATA_EVENTS) {
          if (d >= evt.dayOffset && d < evt.dayOffset + evt.duration &&
              evt.geos.some(g => campaign.geos.includes(g) || g === 'national')) {
            eventSpendMult *= evt.spendMult;
            eventCvrMult *= evt.cvrMult;
            eventEngageMult *= evt.engageMult;
          }
        }

        const noise = 1 + gaussian() * profile.volatility;
        const spendBase = profile.baseSpend * campaign.budgetMultiplier * geoMult * weekendMult * seasonality * growthTrend * eventSpendMult * Math.max(0.3, noise);
        const spend = Math.max(10, spendBase);

        const cpm = randBetween(profile.cpmRange[0], profile.cpmRange[1]) * (1 + gaussian() * 0.1);
        const impressions = Math.round((spend / cpm) * 1000);
        const reach = Math.round(impressions * randBetween(0.6, 0.85));

        const ctr = randBetween(profile.ctrRange[0], profile.ctrRange[1]) * Math.max(0.5, 1 + gaussian() * 0.15) / 100;
        const clicks = Math.round(impressions * ctr);

        const lpvRate = randBetween(0.5, 0.8);
        const landingPageViews = Math.round(clicks * lpvRate);

        const cvr = randBetween(profile.cvrRange[0], profile.cvrRange[1]) * campaign.cvrModifier * eventCvrMult * Math.max(0.3, 1 + gaussian() * 0.15) / 100;
        const conversions = Math.max(0, Math.round(clicks * cvr));
        const leads = Math.round(conversions * randBetween(1.5, 3));

        const dayTrend = 1 + (campaign.revTrend * d);
        const avgOrderValue = randBetween(campaign.revPerConvRange[0], campaign.revPerConvRange[1]);
        const revenue = conversions * avgOrderValue * randBetween(0.85, 1.15) * dayTrend;

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
              geo: campaignDef.geos[0],
              division: campaignDef.division,
              productLine: campaignDef.productLine,
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
  brand: ['Wall Street Journal', 'Bloomberg', 'Financial Times', 'Reuters', 'AdAge', 'CNBC'],
  banking: ['OCC Bulletin', 'Wall Street Journal', 'Bloomberg', 'American Banker', 'Reuters'],
  'credit-cards': ['Wall Street Journal', 'NerdWallet', 'The Points Guy', 'Bloomberg', 'AdAge'],
  fintech: ['TechCrunch', 'The Information', 'Wall Street Journal', 'Axios', 'Bloomberg'],
  social: ['Reddit r/personalfinance', 'Reddit r/investing', 'TikTok #FinTok', 'Reddit r/churning', 'X/Twitter Finance'],
  sports: ['ESPN', 'Fox Sports', 'USTA Media', 'AdAge', 'Wall Street Journal'],
  sponsorships: ['ESPN', 'USTA Media', 'The Athletic', 'AdAge', 'Front Office Sports'],
  competitors: ['Wall Street Journal', 'Bloomberg', 'NerdWallet', 'The Points Guy', 'Business Insider'],
  macro: ['Bureau of Labor Statistics', 'Federal Reserve', 'Wall Street Journal', 'Bloomberg', 'Deloitte'],
};

function generateNews(): NewsItem[] {
  const items: NewsItem[] = [];
  const templates: Array<{
    titleTemplate: (c?: string) => string; tags: NewsTag[]; urgency: NewsUrgency;
    summary: string; whyItMatters: string; competitor?: string;
  }> = [
    // ── 1. Brand & Corporate (3 pinned) ──
    { titleTemplate: () => 'JPMorgan Chase Q1 2026 Earnings Beat Expectations — Digital Banking Growth Highlighted as Key Driver', tags: ['brand'], urgency: 'high',
      summary: 'JPMorgan Chase reported Q1 2026 earnings above analyst expectations, with digital banking transactions up 34% year-over-year. Media coverage frames Chase as America\'s digital banking leader, with Jamie Dimon citing mobile-first initiatives and the Freedom Unlimited card launch as catalysts for younger customer acquisition.',
      whyItMatters: 'Positive earnings narrative reinforces Chase\'s market leadership positioning. Media is connecting digital transformation to financial performance — amplify this story across paid channels before the news cycle moves on.' },
    { titleTemplate: () => 'Chase Sapphire Preferred Named #1 Travel Rewards Card by NerdWallet Annual Rankings', tags: ['brand'], urgency: 'high',
      summary: 'NerdWallet\'s annual credit card rankings have named Chase Sapphire Preferred as the #1 travel rewards card in the U.S. for the third consecutive year. The ranking cited superior lounge access via Priority Pass, travel insurance coverage, and the Ultimate Rewards points ecosystem. Brand recall for Sapphire surged 18% in the week following publication.',
      whyItMatters: 'Third-party validation from a trusted source is the highest-value brand signal. This ranking should be amplified across all Sapphire campaigns immediately — it provides credibility that paid messaging alone cannot achieve.' },
    { titleTemplate: () => 'JPMorgan Chase ESG/Climate Commitments Draw Mixed Reception — Sustainability Report Under Scrutiny', tags: ['brand'], urgency: 'medium',
      summary: 'JPMorgan Chase\'s latest sustainability report highlights $1T in sustainable financing commitments and net-zero targets. Reception is mixed: sustainability advocates praise the direction while environmental groups question fossil fuel lending exposure. Social media discussion is polarized but engagement is high.',
      whyItMatters: 'ESG narrative requires careful management — positive signals exist but the story isn\'t fully landed. Monitor sentiment closely and consider proactive communication to control the framing before critics dominate the conversation.' },

    // ── 2. Banking Industry (3 pinned) ──
    { titleTemplate: () => 'CFPB Finalizes Open Banking Framework — Big Four Banks Given 18-Month Implementation Timeline', tags: ['banking'], urgency: 'high',
      summary: 'The CFPB has finalized the U.S. open banking framework under Section 1033, giving the Big Four banks 18 months to implement consumer data portability standards. The framework requires standardized APIs for account data sharing, transaction history, and product switching. Industry analysts expect this to accelerate fintech partnerships and competitive dynamics.',
      whyItMatters: 'Open banking will reshape how Americans choose financial products. Chase must position its digital experience as the reason customers stay — marketing should emphasize the strength of Chase\'s integrated ecosystem before competitors frame data portability as a reason to switch.' },
    { titleTemplate: () => 'Federal Reserve Signals Potential Rate Cut — Mortgage and Lending Markets Respond', tags: ['banking'], urgency: 'high',
      summary: 'Federal Reserve Chair Jerome Powell signalled a potential rate cut in upcoming decisions, citing slowing inflation and housing market concerns. Mortgage pre-approval applications surged 22% within 48 hours. Fixed-rate mortgage pricing is already adjusting downward across the Big Four.',
      whyItMatters: 'Rate cut signals drive immediate consumer action in mortgage and lending. Chase\'s mortgage campaigns should accelerate spend while consumer intent is elevated — the window for capturing rate-sensitive demand is narrow.' },
    { titleTemplate: () => 'U.S. Banking Digital Adoption Reaches 78% — Mobile-First Banks Growing 3x Faster', tags: ['banking'], urgency: 'medium',
      summary: 'American Bankers Association data shows digital banking adoption has reached 78% of U.S. adults, with mobile-first interactions now exceeding branch visits by 5:1. Banks with strong mobile app experiences are acquiring customers 3x faster than those relying on branch networks.',
      whyItMatters: 'Digital adoption acceleration validates Chase\'s mobile-first investment thesis. Marketing should emphasize app experience quality and digital-exclusive features to capture the growing cohort of Americans who will never visit a branch.' },

    // ── 3. Credit Cards (3 pinned) ──
    { titleTemplate: () => 'U.S. Credit Card Rewards War Intensifies — Sapphire, Amex Platinum, Citi Premier Battle for Premium Cardholders', tags: ['credit-cards'], urgency: 'high',
      summary: 'Competition for premium credit card customers in the U.S. has reached unprecedented levels. Chase Sapphire, Amex Platinum, and Citi Premier are all increasing welcome bonuses, accelerating earn rates, and expanding lounge access. Customer acquisition costs for premium cards have risen 28% year-over-year as banks fight for high-value cardholders.',
      whyItMatters: 'The rewards war is driving up acquisition costs but also increasing consumer awareness of card benefits. Chase\'s Sapphire campaigns must differentiate on experience quality and ecosystem breadth, not just points — competing on sign-up bonuses alone is unsustainable.' },
    { titleTemplate: () => 'Buy Now Pay Later Regulation Tightens in U.S. — BNPL Providers Face New CFPB Oversight', tags: ['credit-cards'], urgency: 'medium',
      summary: 'The CFPB has finalized rules bringing Buy Now Pay Later providers under consumer protection oversight, requiring disclosure standards, credit checks, and complaint handling processes. Traditional credit card issuers may benefit as BNPL loses its regulatory arbitrage advantage.',
      whyItMatters: 'BNPL regulation levels the playing field for traditional credit cards. Chase can position credit cards as the safer, more transparent alternative — marketing should emphasize consumer protection and responsible lending as BNPL faces scrutiny.' },
    { titleTemplate: () => 'Contactless Payment Adoption in U.S. Hits 92% — Tap-to-Pay Now Default Consumer Behavior', tags: ['credit-cards'], urgency: 'medium',
      summary: 'Visa and Mastercard report contactless payment adoption has reached 92% of U.S. card transactions. Tap-to-pay is now the default behavior, with consumers actively avoiding merchants that require chip insertion or PIN entry. Mobile wallet integration is the next frontier.',
      whyItMatters: 'Near-universal contactless adoption means payment convenience is no longer a differentiator — it\'s table stakes. Chase should shift card marketing emphasis from tap convenience to ecosystem benefits, rewards quality, and digital wallet integration.' },

    // ── 4. Fintech (3 pinned) ──
    { titleTemplate: () => 'Robinhood Surpasses 24M Users — Aggressive Ad Spend on TikTok and Instagram Targeting 18-34', tags: ['fintech'], urgency: 'high',
      summary: 'Robinhood has surpassed 24 million funded accounts in the U.S., driven by aggressive performance marketing on TikTok and Instagram targeting the 18-34 demographic. The fintech\'s ad spend has increased 180% year-over-year, with influencer partnerships and UGC-style content generating strong engagement and conversion rates.',
      whyItMatters: 'Robinhood is the most aggressive competitor in the young-professional investing segment — directly threatening J.P. Morgan Self-Directed Investing acquisition. J.P. Morgan wealth campaigns must match Robinhood\'s social-native creative approach while emphasizing the depth of J.P. Morgan\'s advisory and product ecosystem.' },
    { titleTemplate: () => 'Ally Bank Launches High-Yield Savings at 4.5% — Puts Pressure on Big Four Deposit Products', tags: ['fintech'], urgency: 'high',
      summary: 'Ally Bank has launched a high-yield savings account at 4.5% APY, significantly above Big Four savings rates averaging 0.1-0.5%. The offer is supported by a national digital campaign targeting rate-sensitive savers. Early reports suggest meaningful deposit outflows from traditional banks in the first two weeks.',
      whyItMatters: 'Ally\'s rate advantage is a direct threat to Chase deposit retention. Marketing for CD and savings products should emphasize the full value of the Chase relationship — security, integration, and advisory access — rather than competing on rate alone.' },
    { titleTemplate: () => 'SoFi Raises $750M — Expansion into Credit Cards and Mortgages', tags: ['fintech'], urgency: 'high',
      summary: 'SoFi has raised $750M in fresh capital and announced plans to deepen its credit card and mortgage offerings. The San Francisco-based fintech is positioning itself as a full-service digital banking alternative to the Big Four.',
      whyItMatters: 'SoFi\'s expansion into credit cards and mortgages represents a direct competitive threat across Chase\'s core product lines. Monitor SoFi\'s product launches and marketing positioning closely — their venture-backed aggressive pricing could capture price-sensitive segments.' },

    // ── 5. Social & Sentiment (3 pinned) ──
    { titleTemplate: () => 'r/personalfinance "Best Credit Card" Mega-Thread Goes Viral — 8K Upvotes, Sapphire Prominently Recommended', tags: ['social'], urgency: 'high',
      summary: 'A mega-thread on r/personalfinance asking "What\'s the best credit card in the U.S. right now?" has hit 8K upvotes and 2,400+ comments. Chase Sapphire Preferred is one of the most frequently recommended cards, with users citing travel benefits, lounge access, and points flexibility. The thread is driving significant referral traffic to Chase\'s credit card comparison page.',
      whyItMatters: 'Reddit mega-threads are high-conviction organic endorsements — they carry more credibility than paid advertising. This thread will be referenced for months. Chase should ensure its credit card landing pages are optimized for the traffic surge and consider subtle community engagement.' },
    { titleTemplate: () => 'TikTok #FinTok Creators Drive 240% Spike in Roth IRA Content — Young Investors Influenced by Social', tags: ['social'], urgency: 'high',
      summary: 'TikTok\'s #FinTok community has driven a 240% spike in Roth IRA-related content, with creators explaining contribution limits, investment strategies, and account comparisons. J.P. Morgan Self-Directed Investing is mentioned in 18% of IRA comparison videos, behind Robinhood (42%) but ahead of other Big Four platforms.',
      whyItMatters: '#FinTok is becoming a primary discovery channel for young investors choosing investment platforms. J.P. Morgan Self-Directed needs stronger social-native content to close the awareness gap with Robinhood — creator partnerships and UGC-style educational content should be prioritized.' },
    { titleTemplate: () => 'r/churning Community Grows to 500K — Sophisticated Consumers Optimizing Card Signup Bonuses', tags: ['social'], urgency: 'medium',
      summary: 'The r/churning community has grown to 500K members, with increasingly sophisticated discussions around credit card signup bonus optimization, product switching strategies, and points maximization. Chase products are frequently discussed, with Sapphire\'s welcome bonus and 5/24 rule strategies being popular topics.',
      whyItMatters: 'The churning community represents a double-edged sword — they drive sign-up volume but can increase acquisition costs through bonus optimization. Understanding their behavior helps Chase design retention-focused card strategies and anticipate promotional response patterns.' },

    // ── 6. Sports (3 pinned) ──
    { titleTemplate: () => 'US Open Tennis Attendance Breaks Records — 950K Visitors, Chase Brand Activations Generate Significant Social Buzz', tags: ['sports'], urgency: 'high',
      summary: 'The US Open Tennis Championships drew record attendance of 950K visitors over the two-week tournament. Chase brand activations including the Chase Lounge, athlete meet-and-greets, and social media content generated over 45M impressions. Post-event surveys show a 28% lift in Chase brand consideration among attendees.',
      whyItMatters: 'Record attendance validates Chase\'s investment in the US Open as a premier brand activation platform. The 28% consideration lift among attendees is a strong ROI signal — post-event retargeting of attendees and social engagers should be activated immediately.' },
    { titleTemplate: () => 'Sports Sponsorship ROI for Financial Brands Hits All-Time High — 32% Lift in Brand Consideration', tags: ['sports'], urgency: 'medium',
      summary: 'Industry research shows financial services brands with active sports sponsorships are seeing a 32% lift in brand consideration and 22% higher trust scores compared to non-sponsoring competitors. Tennis, NBA, and NFL sponsorships deliver the highest ROI for banking brands in the U.S. market.',
      whyItMatters: 'Sports sponsorship ROI at all-time highs validates Chase\'s portfolio of tennis, NBA, and golf partnerships. Consider increasing sports marketing investment to capture disproportionate brand consideration gains — especially among the 25-54 demographic that indexes highest for financial product decisions.' },
    { titleTemplate: () => 'Team Chase Athletes Win 4 Majors in 2025 — Media Value of Sponsorship Portfolio Exceeds $120M', tags: ['sports'], urgency: 'medium',
      summary: 'Team Chase athletes collectively won 4 major tennis and golf championships in 2025, generating an estimated $120M in media value for the Chase brand. The wins drove significant organic social media coverage and brand association, with Chase mentions in sports media up 340% during championship weeks.',
      whyItMatters: 'Major championship wins create peak media value moments for Chase\'s sponsorship portfolio. The $120M media value equivalent far exceeds sponsorship costs — this data supports continued and expanded investment in Team Chase athlete partnerships.' },

    // ── 7. Sponsorships (3 pinned) ──
    { titleTemplate: () => 'US Open 2026 Announced at Flushing Meadows — Chase Early Ticket Sales Up 45%', tags: ['sponsorships'], urgency: 'high',
      summary: 'The 2026 US Open Tennis Championships has been announced at the USTA Billie Jean King National Tennis Center in New York, with early ticket sales up 45% over the prior year. Chase, as title sponsor, will feature an expanded Chase Lounge hospitality program and enhanced digital fan experiences. Media coverage is positioning the event as a must-attend for New York\'s business community.',
      whyItMatters: 'Strong early ticket sales indicate growing event prestige and corporate interest. Chase should leverage the announcement momentum to activate early hospitality sales, corporate partnership conversations, and pre-event brand campaigns targeting the New York business community.' },
    { titleTemplate: () => 'Team Chase Adds Two Rising Tennis Stars — Portfolio Now Spans 12 Athletes Across Tennis and Olympic Sports', tags: ['sponsorships'], urgency: 'medium',
      summary: 'Chase has expanded its athlete sponsorship portfolio to 12 athletes by adding two rising WTA/ATP stars with strong social media followings. The portfolio now spans professional tennis and Olympic sports, providing year-round brand visibility across major sporting events and social media channels.',
      whyItMatters: 'Expanding the athlete portfolio with social-media-native athletes ensures Chase\'s sponsorship investment generates value beyond traditional broadcast — younger athletes with strong Instagram and TikTok presence create content opportunities that align with digital-first marketing strategies.' },
    { titleTemplate: () => 'JPMorgan Chase Community Sponsorship Program Reaches 1,200 Events Nationwide — Grassroots Brand Building', tags: ['sponsorships'], urgency: 'medium',
      summary: 'JPMorgan Chase\'s community sponsorship program has reached 1,200 events across all 50 U.S. states. The program spans local sports teams, cultural festivals, charitable runs, and community celebrations, generating grassroots brand presence in markets where national advertising alone cannot reach.',
      whyItMatters: 'Community sponsorship creates hyperlocal brand affinity that complements national campaigns. Each event generates organic social content and word-of-mouth — marketing should integrate community sponsorship stories into regional campaigns to create authentic local connection.' },

    // ── 8. Competitors (3 pinned) ──
    { titleTemplate: () => 'Bank of America Launches "BofA Premium Travel" Card — Direct Competitor to Sapphire with 6x Points on Travel', tags: ['competitors'], urgency: 'high', competitor: 'Bank of America',
      summary: 'Bank of America has launched the "BofA Premium Travel" card offering 6x points on travel purchases, a $400 welcome bonus, and complimentary Priority Pass lounge access. The card is supported by a $15M launch campaign across TV, digital, and social channels targeting premium travelers — the same audience Chase Sapphire competes for.',
      whyItMatters: 'BofA\'s new card is a direct competitive response to Sapphire\'s market leadership. The 6x travel earn rate matches Sapphire\'s best tier. Chase should consider a competitive response emphasizing Sapphire\'s broader ecosystem, established lounge network, and travel insurance superiority.' },
    { titleTemplate: () => 'Wells Fargo Rewards Integrates with Hotel and Grocery Partners — Lifestyle Rewards Positioning', tags: ['competitors'], urgency: 'high', competitor: 'Wells Fargo',
      summary: 'Wells Fargo has expanded its rewards program integration to include major hotel and grocery partners, positioning the program as a lifestyle rewards platform rather than purely travel-focused. The strategy targets families and everyday spenders who value practical rewards over aspirational travel benefits.',
      whyItMatters: 'Wells Fargo is differentiating its rewards from travel-focused competitors like Sapphire by targeting everyday spending. Chase should monitor whether this lifestyle positioning shifts card consideration among families — the Ultimate Rewards program may need to emphasize its own everyday earning potential.' },
    { titleTemplate: () => 'Citi Launches "Citi Digital Savings" at 4.25% — Competing with Fintech Challengers', tags: ['competitors'], urgency: 'high', competitor: 'Citigroup',
      summary: 'Citi has launched "Citi Digital Savings," a digital-only high-yield savings account offering 4.25% APY with no minimum balance. The product is designed to compete directly with fintech challengers like Ally and Marcus, using Citi\'s brand trust and FDIC insurance as key differentiators against digital-native competitors.',
      whyItMatters: 'Citi Digital Savings signals that Big Four banks are taking fintech savings competition seriously. If Citi\'s digital-only approach succeeds, Chase may need a similar high-yield digital savings product to prevent deposit outflows to both fintech and Big Four competitors.' },

    // ── 9. Macro (3 pinned) ──
    { titleTemplate: () => 'U.S. Consumer Confidence Rises in Q1 2026 — But Housing Affordability Remains Top Concern', tags: ['macro'], urgency: 'high',
      summary: 'The Conference Board reports consumer confidence rose modestly in Q1 2026, driven by easing inflation and stable employment. However, housing affordability remains the #1 consumer concern, with 68% of Americans citing it as their primary financial worry. Spending intent is cautiously positive for financial products.',
      whyItMatters: 'Rising confidence creates opportunity for financial product marketing, but housing anxiety means mortgage and homeownership messaging must be carefully calibrated. Emphasize accessibility and support rather than aspirational homeownership narratives.' },
    { titleTemplate: () => 'Federal Reserve Holds Rate at 4.50% — Signals Data-Dependent Approach for Remainder of 2026', tags: ['macro'], urgency: 'high',
      summary: 'The Federal Reserve held its benchmark rate at 4.50%, signaling a data-dependent approach for the remainder of 2026. The decision was widely expected, but the accompanying statement emphasized housing market stability concerns and global trade uncertainty as key factors in future rate decisions.',
      whyItMatters: 'Rate stability provides a predictable environment for mortgage and savings marketing. Chase should use the holding pattern to emphasize rate-lock advantages for mortgage products and competitive CD rates while the rate environment remains attractive.' },
    { titleTemplate: () => 'U.S. Household Debt-to-Income Ratio Stabilizes at 102% — Mortgage Refinance Wave Becomes Key Concern', tags: ['macro'], urgency: 'medium',
      summary: 'The Federal Reserve reports the U.S. household debt-to-income ratio has stabilized at 102%, with mortgage debt comprising the largest component. Approximately 6 million American mortgages will face rate resets or refinance opportunities in 2026-2027, many at significantly different rates than their original terms. Financial advisors are urging proactive planning.',
      whyItMatters: 'The mortgage refinance wave is a massive marketing opportunity for Chase. Proactive outreach to existing customers and competitive conquest campaigns targeting borrowers at other institutions should be a priority for the mortgage marketing team.' },

    // ── Loop articles ──
    // Brand loop
    { titleTemplate: () => 'Chase Mobile App Downloads Surge 42% After Feature Update — Biometric Login and Instant Zelle Drive Adoption', tags: ['brand'], urgency: 'medium',
      summary: 'Chase\'s mobile banking app saw a 42% surge in downloads following a major feature update introducing biometric login and instant Zelle transfers. App store ratings improved to 4.7/5.0, and mobile-first transaction volume increased significantly in the first two weeks post-update.',
      whyItMatters: 'App adoption surges create windows for cross-selling financial products to newly engaged digital customers. Marketing should capitalize on the positive sentiment with in-app product recommendations and targeted push notification campaigns.' },
    { titleTemplate: () => 'JPMorgan Chase Named America\'s Most Valuable Banking Brand — BrandZ Global Rankings Place JPM at #8 Worldwide', tags: ['brand'], urgency: 'high',
      summary: 'BrandZ\'s annual global brand valuation has ranked JPMorgan Chase as America\'s most valuable banking brand and #8 globally across all financial services brands. The ranking cited JPM\'s digital transformation leadership, sponsorship portfolio strength, and customer satisfaction scores as key drivers of brand equity growth.',
      whyItMatters: 'Global brand ranking validation provides powerful third-party credibility. This data point should be integrated into corporate brand campaigns and used as a trust signal in competitive markets where JPM faces challenges from fintech and Big Four competitors.' },
    { titleTemplate: () => 'J.P. Morgan Wealth Management Client Assets Reach Record $4.5T — Advisory Platform Modernization Cited as Growth Driver', tags: ['brand'], urgency: 'medium',
      summary: 'J.P. Morgan Wealth Management has reached record client assets of $4.5 trillion, driven by platform modernization and a 28% increase in new advisory relationships. The growth is concentrated in the high-net-worth and ultra-high-net-worth segments, with digital onboarding reducing client acquisition timelines by 60%.',
      whyItMatters: 'Record wealth management assets validate J.P. Morgan\'s investment in advisory platform modernization. Marketing for J.P. Morgan Wealth Management and Self-Directed Investing should leverage the scale narrative — "America\'s largest wealth platform" is a compelling trust signal for high-net-worth prospects.' },

    // Banking loop
    { titleTemplate: () => 'Open Banking Pilot Programs Launch in New York — Early Consumer Adoption Signals Strong Demand for Data Portability', tags: ['banking'], urgency: 'medium',
      summary: 'New York\'s open banking pilot programs have launched with strong early consumer adoption, with 340K users connecting their bank accounts to third-party comparison tools in the first month. The pilots suggest Americans are eager to compare financial products across institutions when given easy access to their data.',
      whyItMatters: 'Strong pilot adoption confirms that open banking will drive product comparison shopping. Chase must ensure its products compete well in side-by-side comparisons — rate transparency, fee structures, and digital experience quality will be the key differentiators.' },
    { titleTemplate: () => 'U.S. Banking Cybersecurity Standards Updated — OCC Requires AI-Powered Fraud Detection by 2027', tags: ['banking'], urgency: 'medium',
      summary: 'The OCC has updated cybersecurity standards to require AI-powered fraud detection systems across all federally regulated banks by 2027. The new requirements include real-time transaction monitoring, behavioral biometrics, and enhanced customer authentication. Banks are investing heavily in cybersecurity infrastructure.',
      whyItMatters: 'Cybersecurity investment is both a compliance requirement and a marketing opportunity. Chase should frame its security investments as customer protection — "your money is safe with Chase" messaging resonates with consumers increasingly concerned about digital fraud.' },

    // Credit cards loop
    { titleTemplate: () => 'Premium Credit Card Applications in U.S. Rise 34% — Travel Recovery Drives Demand for Rewards Cards', tags: ['credit-cards'], urgency: 'medium',
      summary: 'Premium credit card applications across U.S. banks have risen 34% year-over-year, driven by continued travel recovery and consumer demand for travel rewards, lounge access, and insurance coverage. The growth is strongest among 25-45 professionals with household income above $100K.',
      whyItMatters: 'Rising premium card demand is a tailwind for Chase Sapphire. Marketing should emphasize the full premium experience — lounge access, travel insurance, and concierge services — to capture high-value applicants while demand is elevated.' },
    { titleTemplate: () => 'U.S. Credit Card Spending Hits Record $1.1T in Q4 — E-Commerce and Travel Drive Growth', tags: ['credit-cards'], urgency: 'medium',
      summary: 'U.S. credit card spending reached a record $1.1T in Q4 2025, with e-commerce transactions up 28% and travel spending up 42% year-over-year. The growth is driving increased interchange revenue for card issuers and creating opportunities for targeted rewards and loyalty marketing.',
      whyItMatters: 'Record spending volume validates the overall card business model. Chase should use spending data insights to create targeted rewards campaigns — e.g., bonus points on travel categories during peak booking seasons, or accelerated earn rates for e-commerce to drive card-on-file behavior.' },

    // Fintech loop
    { titleTemplate: () => 'U.S. Fintech Investment Reaches $28B in 2025 — Payments and Lending Lead Funding Categories', tags: ['fintech'], urgency: 'medium',
      summary: 'U.S. fintech investment reached $28B in 2025, with payments and lending startups attracting the most capital. Investor interest is concentrated in companies challenging traditional banking products — savings accounts, credit cards, and mortgage origination. Several fintechs are now pursuing bank charters.',
      whyItMatters: 'Sustained fintech investment means competition will intensify, not subside. Chase must continuously improve its digital products to match fintech user experience standards while leveraging its regulatory moat and brand trust as competitive advantages.' },
    { titleTemplate: () => 'Chime Launches Credit Building Product — Free Alternative to Traditional Credit Cards Targets Underserved Americans', tags: ['fintech'], urgency: 'medium',
      summary: 'Chime has launched a credit building product that allows users to build credit scores without a traditional credit card, targeting underserved Americans including newcomers, students, and those with limited credit history. The product is free with a premium upgrade path.',
      whyItMatters: 'Chime\'s credit builder targets the same newcomer and student segments as Chase\'s Welcome to America and Student Banking campaigns. Chase should monitor Chime\'s acquisition metrics in these segments and ensure its own onboarding experience remains competitive for credit-building customers.' },

    // Social loop
    { titleTemplate: () => 'Reddit r/personalfinance "Rate My Portfolio" Weekly Thread Shows Growing Interest in J.P. Morgan Self-Directed', tags: ['social'], urgency: 'medium',
      summary: 'The popular weekly "Rate My Portfolio" thread on r/personalfinance shows growing mentions of J.P. Morgan Self-Directed Investing, with users citing the platform\'s research tools and 401(k)/IRA integration. While Robinhood remains the most recommended platform, J.P. Morgan\'s share of positive mentions has increased 15% over the past quarter.',
      whyItMatters: 'Organic Reddit sentiment shifting toward J.P. Morgan Self-Directed signals that product improvements are being noticed by the community. Marketing should monitor these threads for content inspiration and consider community engagement strategies that build on this positive momentum.' },
    { titleTemplate: () => 'TikTok "Day in My Life as a Banker" Trend Generates 180M Views — Humanizing Financial Institutions', tags: ['social'], urgency: 'low',
      summary: 'A TikTok trend featuring bank employees sharing "day in my life" content has generated 180M views globally, with U.S. bank employees prominently represented. The content humanizes financial institutions and is driving positive sentiment among younger demographics.',
      whyItMatters: 'Employee-generated content on TikTok creates authentic brand visibility at zero media cost. Chase should consider supporting employee content creation within brand guidelines — the trend humanizes the institution and resonates with demographics that distrust corporate advertising.' },

    // Sports loop
    { titleTemplate: () => 'NBA Playoffs Drive Surge in Financial Product Searches — "Best Credit Card" Queries Up 45% During Game Nights', tags: ['sports'], urgency: 'medium',
      summary: 'Google Trends data shows a 45% increase in financial product searches during NBA playoff game nights, with "best credit card," "savings account rates," and "investment app" among the most searched terms. The correlation suggests sports viewers are engaged and receptive to financial advertising during live sports.',
      whyItMatters: 'Sports viewership drives financial product consideration — a valuable insight for media planning. Chase should ensure strong search presence for key financial product terms during NBA playoff periods and align CTV and social ad delivery with game schedules.' },
    { titleTemplate: () => 'Tennis Sponsorship ROI Study Shows 3.5x Return for Financial Brands — Chase US Open Among Top Performers', tags: ['sports'], urgency: 'medium',
      summary: 'A new sponsorship ROI study shows financial services brands generate an average 3.5x return on tennis sponsorship investment, with the Chase US Open partnership ranking among the top three performing events globally. The study attributes the high ROI to tennis\'s affluent audience profile and extended brand engagement during tournament week.',
      whyItMatters: 'Quantified ROI data validates continued and expanded investment in the US Open sponsorship. The 3.5x return figure should be used in internal budget discussions and can inform future sponsorship portfolio decisions.' },

    // Sponsorships loop
    { titleTemplate: () => 'JPMorgan Chase Foundation Announces $50M Community Impact Fund — Supporting Financial Literacy Across U.S.', tags: ['sponsorships'], urgency: 'medium',
      summary: 'The JPMorgan Chase Foundation has announced a $50M community impact fund focused on financial literacy programs across the U.S. The fund will support financial education in schools, newcomer financial integration programs, and small business mentorship. The announcement received positive media coverage and strong social media engagement.',
      whyItMatters: 'Community investment in financial literacy creates long-term brand affinity and customer pipeline. The announcement provides authentic content for brand campaigns and demonstrates JPMorgan Chase\'s commitment to financial inclusion — messaging that resonates strongly with younger demographics.' },
    { titleTemplate: () => 'Team Chase Athlete Wins First Grand Slam — Social Media Celebration Generates $18M in Brand Value', tags: ['sponsorships'], urgency: 'high',
      summary: 'A Team Chase tennis player\'s first Grand Slam victory generated an estimated $18M in brand value for Chase through broadcast logos, social media mentions, and post-victory interviews. Chase\'s congratulatory social content received 4.2M impressions and the brand was mentioned in 89% of media coverage of the victory.',
      whyItMatters: 'Grand Slam wins create peak brand value moments that cannot be replicated through paid media. The $18M brand value equivalent from a single victory validates the Team Chase investment model — future athlete selection should prioritize competitiveness in major championships.' },

    // Competitors loop
    { titleTemplate: () => 'Capital One Launches AI-Powered Financial Planning Tool — First Big Four Bank to Offer Automated Advice', tags: ['competitors'], urgency: 'medium', competitor: 'Capital One',
      summary: 'Capital One has launched an AI-powered financial planning tool that provides automated investment advice, retirement projections, and tax optimization strategies. The tool is available free to all Capital One clients and is being positioned as a bridge between self-directed investing and full-service advisory.',
      whyItMatters: 'Capital One\'s AI advisory tool sets a new bar for digital financial planning. If adoption is strong, other Big Four banks including Chase will face pressure to offer similar capabilities. Monitor Capital One\'s user adoption metrics and client satisfaction data for competitive intelligence.' },
    { titleTemplate: () => 'US Bank Acquires Fintech Lender — Signals Consolidation Trend Between Banks and Fintechs', tags: ['competitors'], urgency: 'medium', competitor: 'US Bank',
      summary: 'US Bank has acquired a U.S. fintech lending platform, signaling a growing trend of traditional banks acquiring fintech capabilities rather than building them internally. The acquisition gives US Bank instant access to the fintech\'s digital origination platform and 200K customer base.',
      whyItMatters: 'Bank-fintech consolidation is accelerating. Chase should evaluate whether strategic fintech acquisitions could accelerate digital product development faster than internal build — particularly in areas where fintech user experience leads traditional banking.' },
    { titleTemplate: () => 'Bank of America Launches Cross-Border Banking Package — Targeting Mexico-Connected Customers and Expats', tags: ['competitors'], urgency: 'medium', competitor: 'Bank of America',
      summary: 'Bank of America has launched an integrated cross-border banking package targeting Mexico-connected customers and American expats, offering seamless USD-MXN account management, competitive exchange rates, and unified digital banking across both countries. The package leverages BofA\'s large Latino customer base.',
      whyItMatters: 'BofA\'s cross-border proposition exploits a strategic advantage Chase cannot easily replicate. Chase should monitor whether cross-border features become a meaningful driver of customer acquisition and consider partnerships that enhance its own cross-border capabilities.' },

    // Macro loop
    { titleTemplate: () => 'U.S. Housing Market Shows Signs of Stabilization — Spring Listings Up 22% Year-Over-Year', tags: ['macro'], urgency: 'medium',
      summary: 'U.S. housing market data shows stabilization with spring listings up 22% year-over-year and price growth moderating to 3-5% annually. First-time buyer activity is increasing in suburban markets as affordability improves relative to peak 2022-2023 levels. Mortgage origination volume is expected to increase significantly in spring 2026.',
      whyItMatters: 'Housing stabilization is a green light for mortgage marketing acceleration. Chase should increase mortgage campaign spend heading into spring — first-time buyer activity increasing in suburban markets aligns perfectly with the First-Time Home Buyer campaign targeting.' },
    { titleTemplate: () => 'U.S. Employment Rate Holds Steady at 60.2% — Tech Sector Layoffs Offset by Services Growth', tags: ['macro'], urgency: 'medium',
      summary: 'The Bureau of Labor Statistics reports the employment-to-population ratio holding steady at 60.2%, with tech sector layoffs offset by growth in healthcare, professional services, and construction. The stable employment picture supports consumer confidence and financial product demand, though income growth remains below inflation in several sectors.',
      whyItMatters: 'Stable employment supports overall financial product demand but uneven income growth means messaging must be nuanced. Value-focused positioning resonates across segments while premium messaging should be targeted to growing income cohorts.' },
    { titleTemplate: () => 'U.S. Consumer Savings Rate Rises to 5.2% — Highest Level Since 2021 as Americans Build Financial Buffers', tags: ['macro'], urgency: 'medium',
      summary: 'The U.S. consumer savings rate has risen to 5.2%, the highest since 2021, as households prioritize financial resilience. The trend is driving demand for high-yield savings accounts, CDs, and investment products. Financial advisors report increased client interest in emergency fund planning and retirement contributions.',
      whyItMatters: 'Rising savings rates create direct demand for Chase\'s savings and investment products. CD, Roth IRA, and 401(k) campaigns should emphasize building financial security — messaging aligned with consumer behavior trends will outperform aspirational wealth-building narratives in this environment.' },
  ];

  // First 27 templates are pinned (3 per category x 9 categories), rest are loop templates
  const pinnedTemplates = templates.slice(0, 27);
  const loopTemplates = templates.slice(27);

  const categoryTags: NewsTag[] = ['brand', 'banking', 'credit-cards', 'fintech', 'social', 'sports', 'sponsorships', 'competitors', 'macro'];
  const categorySources: Record<string, string[][]> = {
    brand: [['Wall Street Journal', 'Bloomberg', 'Financial Times']],
    banking: [['OCC Bulletin', 'Wall Street Journal', 'Bloomberg']],
    'credit-cards': [['Wall Street Journal', 'NerdWallet', 'The Points Guy']],
    fintech: [['TechCrunch', 'The Information', 'Wall Street Journal']],
    social: [['Reddit r/personalfinance', 'TikTok #FinTok', 'Reddit r/churning']],
    sports: [['ESPN', 'Fox Sports', 'USTA Media']],
    sponsorships: [['ESPN', 'USTA Media', 'AdAge']],
    competitors: [['Wall Street Journal', 'Bloomberg', 'NerdWallet']],
    macro: [['Bureau of Labor Statistics', 'Federal Reserve', 'Wall Street Journal']],
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
        regions: ['national'] as GeoId[],
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
    const geos = pickN(ALL_GEOS, randInt(1, 3));

    items.push({
      id: `news-loop-${i}`,
      title: template.titleTemplate(),
      source: pick(sources),
      date,
      tags: template.tags,
      regions: geos,
      urgency: template.urgency,
      summary: template.summary,
      whyItMatters: template.whyItMatters,
      competitor: template.competitor,
    });
  }

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

// ===== Action Step Templates =====
// ===== Curated Insight Generation =====
function generateInsights(_anomalies: Anomaly[]): Insight[] {
  const today = format(END_DATE, 'yyyy-MM-dd');
  const yesterday = format(subDays(END_DATE, 1), 'yyyy-MM-dd');

  return [
    {
      id: 'insight-agency-collision', createdAt: today, scope: 'brand', category: 'cross-agency',
      channels: ['instagram', 'facebook'],
      title: 'Agency Audience Collision Detected',
      summary: 'Omnicom (Sapphire Points Accelerator) and In-House (Ultimate Rewards Awareness) are both targeting Young Professionals on Instagram and Facebook during the same flight window. The audience overlap is driving estimated CPM inflation of 22% on Meta platforms. Neither agency can see this collision because each only has visibility into their own campaigns. Coordinating flight schedules would reduce CPM by an estimated $2.40 and save $38K over the remaining flight.',
      evidence: ['Sapphire Points Accelerator (Omnicom) + Ultimate Rewards Awareness (In-House) both targeting Young Professionals on Instagram', 'Instagram CPM rose 22% since both campaigns went live simultaneously', 'Combined audience overlap: ~68% of impressions reaching the same users', 'Estimated CPM inflation cost: $38K over remaining 3-week flight'],
      confidence: 87, impactEstimate: '-$38K CPM waste',
      recommendedAction: 'Stagger Omnicom and In-House flights by 2 weeks on Instagram to reduce self-competition, or assign primary Young Professional ownership to one agency per channel',
      status: 'new',
      actionSteps: [
        { id: 'step-1a', title: 'Stagger Agency Flights', subtitle: 'OFFSET OMNICOM AND IN-HOUSE META FLIGHTS BY 2 WEEKS', type: 'scheduling', completed: false },
        { id: 'step-1b', title: 'Assign Audience Ownership', subtitle: 'GIVE YOUNG PROFESSIONALS ON META TO OMNICOM EXCLUSIVELY', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'insight-frequency-overexposure', createdAt: today, scope: 'brand', category: 'cross-agency',
      channels: ['instagram', 'facebook', 'tiktok', 'ctv', 'ttd', 'spotify', 'google-search', 'ooh'],
      title: 'Cross-Agency Frequency Over-Exposure',
      summary: 'Young Professionals are being exposed to Chase advertising 13.7 times per week across all channels and agencies. Each agency believes they are at a healthy 4-5x because they only see their own frequency. The combined cross-agency exposure exceeds the 8x optimal threshold by 71%, causing estimated ad fatigue and wasting approximately $48K per week in redundant impressions that generate negative marginal returns.',
      evidence: ['Combined cross-agency weekly frequency: 13.7x (optimal threshold: 6-8x)', 'Omnicom frequency contribution: 5.8x across 8 campaigns', 'In-House frequency contribution: 4.2x across 4 campaigns', 'Publicis frequency contribution: 2.4x across 3 campaigns', 'CTR drops 40% after 9th weekly impression across historical data', 'Estimated weekly waste from excess frequency: $48K'],
      confidence: 91, impactEstimate: '-$48K waste/week',
      recommendedAction: 'Implement a portfolio-level frequency cap of 8x per week across all agencies. Requires STRATIS-level orchestration since no single agency can enforce cross-agency caps.',
      status: 'new',
      actionSteps: [
        { id: 'step-2a', title: 'Set Portfolio Frequency Cap', subtitle: 'IMPLEMENT 8X WEEKLY CAP ACROSS ALL AGENCIES', type: 'targeting', completed: false },
        { id: 'step-2b', title: 'Redistribute Excess Budget', subtitle: 'MOVE SAVINGS TO UNDER-REACHED SEGMENTS (NEWCOMERS TO U.S., RETIREES)', type: 'budget', completed: false },
        { id: 'step-2c', title: 'Assign Channel Ownership', subtitle: 'EACH AGENCY OWNS SPECIFIC CHANNELS TO PREVENT OVERLAP', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'insight-attribution-blind', createdAt: yesterday, scope: 'brand', category: 'cross-channel',
      channels: ['ctv', 'ooh', 'spotify', 'google-search', 'facebook'],
      title: 'Awareness Channels Under-Valued by Attribution',
      summary: 'CTV, OOH, and Spotify show direct ROAS of 0.5x, 0.1x, and 0.3x respectively — appearing to lose money. However, their assisted conversion ratios are 3.2x, 2.8x, and 2.1x their direct conversions, meaning 70-76% of their true value is invisible in standard last-click reporting. Campaigns running CTV + Search together generate 42% higher conversion rates than Search alone. Cutting awareness channels based on direct ROAS would collapse downstream conversion performance.',
      evidence: ['CTV direct ROAS: 0.5x — but assisted conversion ratio: 3.2x direct', 'OOH direct ROAS: 0.1x — assisted ratio: 2.8x', 'Spotify direct ROAS: 0.3x — assisted ratio: 2.1x', 'Campaigns with CTV + Search show 42% higher conversion rate than Search-only campaigns', '76% of CTV\'s value is invisible in last-click attribution'],
      confidence: 84, impactEstimate: '+$180K misattributed value',
      recommendedAction: 'Adopt an assisted-conversion-weighted attribution model for budget decisions. Increase CTV investment by 15% funded by reducing over-attributed Search spend by 8% — net portfolio ROAS will improve.',
      status: 'new',
      actionSteps: [
        { id: 'step-3a', title: 'Adopt Blended Attribution', subtitle: 'WEIGHT ASSISTED CONVERSIONS AT 40% IN BUDGET DECISIONS', type: 'budget', completed: false },
        { id: 'step-3b', title: 'Increase CTV Investment', subtitle: 'RAISE CTV BUDGET 15% FUNDED BY SEARCH REALLOCATION', type: 'budget', completed: false },
      ],
    },
    {
      id: 'insight-product-cannibalization', createdAt: yesterday, scope: 'division', category: 'cross-product',
      division: 'pcb', channels: ['google-search'],
      title: 'Product Self-Cannibalization on Search',
      summary: 'Freedom Card Digital Launch and Sapphire Points Accelerator are both running conversion campaigns on Google Search targeting Young Professionals. Both campaigns are bidding on the same audience intent signals, effectively competing against each other in the auction and inflating Chase\'s own CPC by an estimated 28%. This internal competition is invisible to Omnicom because both campaigns are theirs — but it\'s a portfolio-level inefficiency. Deconflicting product targeting would save an estimated $22K per month.',
      evidence: ['Freedom Launch + Sapphire Points Accelerator: both on Google Search targeting Young Professionals', 'CPC on overlapping audience segments rose 28% since both campaigns went live', 'Both managed by Omnicom — agency sees them as separate campaigns, not competing products', 'Estimated monthly waste from internal auction competition: $22K'],
      confidence: 82, impactEstimate: '-$22K/month CPC waste',
      recommendedAction: 'Assign distinct audience intent signals per product: Freedom owns "cashback" and "no fee" intent, Sapphire owns "travel rewards" and "points" intent.',
      status: 'new',
      actionSteps: [
        { id: 'step-4a', title: 'Deconflict Product Targeting', subtitle: 'ASSIGN DISTINCT AUDIENCE SEGMENTS TO FREEDOM VS SAPPHIRE ON SEARCH', type: 'targeting', completed: false },
        { id: 'step-4b', title: 'Implement Funnel Stage Separation', subtitle: 'FREEDOM OWNS TOP-FUNNEL, SAPPHIRE OWNS BOTTOM-FUNNEL FOR SHARED AUDIENCES', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'insight-awareness-correlation', createdAt: today, scope: 'brand', category: 'cross-channel',
      channels: ['ctv', 'ooh', 'spotify', 'google-search', 'instagram', 'facebook'],
      title: 'Awareness Investment Drives Conversion Efficiency',
      summary: 'During the IRA/401(k) event period, awareness campaign spend surged 60% — and conversion campaign ROAS improved 28% without any additional conversion budget. Conversely, during the Robinhood competitive window when awareness engagement dropped 20%, conversion ROAS fell 15%. This temporal correlation across 180 days of data strongly suggests that awareness investment directly fuels downstream conversion efficiency. Cutting awareness to fund performance is self-defeating.',
      evidence: ['IRA/401(k) period: awareness spend +60% → conversion ROAS improved +28%', 'Robinhood competitive window: awareness engagement -20% → conversion ROAS fell -15%', 'Correlation coefficient between weekly awareness spend and conversion ROAS: 0.72', 'Conversion campaigns with awareness pre-exposure: 2.4x ROAS vs 1.6x without'],
      confidence: 79, impactEstimate: '+$95K if awareness maintained',
      recommendedAction: 'Protect awareness budget from mid-flight cuts. Set a floor at 35% of total portfolio spend for awareness-objective campaigns.',
      status: 'new',
      actionSteps: [
        { id: 'step-5a', title: 'Set Awareness Budget Floor', subtitle: 'PROTECT 35% MINIMUM PORTFOLIO ALLOCATION FOR AWARENESS CAMPAIGNS', type: 'budget', completed: false },
        { id: 'step-5b', title: 'Create Awareness-Conversion Dashboard', subtitle: 'TRACK WEEKLY RELATIONSHIP BETWEEN AWARENESS SPEND AND CONVERSION ROAS', type: 'budget', completed: false },
      ],
    },
    {
      id: 'insight-geo-arbitrage', createdAt: yesterday, scope: 'brand', category: 'portfolio',
      channels: ['google-search', 'instagram', 'facebook', 'linkedin'],
      title: 'Geographic Budget Arbitrage Opportunity',
      summary: 'The West region (CA + OR + WA) delivers 32% lower CPA than the Northeast across all campaigns, but is receiving only 18% of national budget allocation. The CPA gap has been consistent for 90+ days, suggesting structural efficiency — not a temporary anomaly. Shifting $200K per month from the Northeast to Western markets would generate an estimated 1,400 additional conversions at current efficiency rates without increasing total spend.',
      evidence: ['West region CPA: $68 vs Northeast CPA: $100 (32% lower)', 'West receives 18% of national budget vs Northeast at 42%', 'CPA gap consistent for 90+ days across all campaign types', 'Estimated incremental conversions from $200K reallocation: 1,400/month'],
      confidence: 88, impactEstimate: '+1,400 conversions/month',
      recommendedAction: 'Gradually shift $200K per month from the Northeast to the West region over 6 weeks. Start with highest-CPA Northeast campaigns.',
      status: 'new',
      actionSteps: [
        { id: 'step-6a', title: 'Increase West Region Budget', subtitle: 'SHIFT $200K/MONTH FROM NORTHEAST TO CA + OR + WA', type: 'budget', completed: false },
        { id: 'step-6b', title: 'Monitor CPA Convergence', subtitle: 'TRACK WHETHER SCALING WEST REGION SPEND DEGRADES EFFICIENCY', type: 'budget', completed: false },
      ],
    },
    {
      id: 'insight-competitive-response', createdAt: today, scope: 'brand', category: 'market-intelligence',
      channels: ['ctv', 'google-search', 'instagram', 'facebook'],
      linkedNewsId: 'news-competitors-0',
      title: 'Coordinated Competitive Response Needed',
      summary: 'Bank of America launched "BofA Premium Travel" 12 days ago with an estimated $15M media campaign. In the same window, Sapphire CTV impression delivery dropped 18% (inventory displacement), Google Search CPA on travel-related audiences rose 34%, and Sapphire brand search volume declined 8%. No single agency sees the full picture — Omnicom sees the CPA rise but not the CTV inventory loss; the In-House team sees brand search decline but not the Search CPA spike. STRATIS connects all three signals to the single competitive event.',
      evidence: ['BofA "Premium Travel" launched Feb 6 — News Feed linked', 'Sapphire CTV impressions: -18% in 12 days since launch', 'Sapphire Google Search CPA: +34% on travel-intent audiences', 'Chase brand search volume: -8% week-over-week', 'Impact spans Omnicom (Search), In-House (Brand), and Publicis (Display) — no single agency sees full picture'],
      confidence: 86, impactEstimate: '-$85K revenue at risk',
      recommendedAction: 'Launch coordinated 3-week competitive response: increase Sapphire Search bids 20% on travel terms, accelerate NerdWallet "#1 Ranked" creative across all CTV and social, and increase retargeting frequency on users who searched BofA travel card.',
      status: 'new',
      actionSteps: [
        { id: 'step-7a', title: 'Surge Sapphire Search Bids', subtitle: 'INCREASE BIDS 20% ON TRAVEL REWARD KEYWORDS FOR 3 WEEKS', type: 'bidding', completed: false },
        { id: 'step-7b', title: 'Accelerate #1 Ranked Messaging', subtitle: 'PUSH NERDWALLET ENDORSEMENT CREATIVE ACROSS ALL CHANNELS', type: 'creative', completed: false },
        { id: 'step-7c', title: 'Activate Conquest Retargeting', subtitle: 'RETARGET USERS WHO SEARCHED BOFA TRAVEL CARD VIA TTD', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'insight-market-event-window', createdAt: yesterday, scope: 'division', category: 'market-intelligence',
      division: 'pcb', productLine: 'mortgage',
      channels: ['google-search', 'instagram', 'facebook', 'ctv', 'ttd'],
      linkedNewsId: 'news-banking-1',
      title: 'Missed Revenue from Market Event Window',
      summary: 'Federal Reserve rate signal on Jan 12 triggered a conversion surge — mortgage applications increased 280% within 72 hours. However, Spring Mortgage campaign budget was pacing at plan ($9.4K/day) rather than surging to capture the demand spike. The campaign hit its daily cap by 2pm each day for 3 consecutive days, missing an estimated 340 incremental mortgage leads worth $320K in attributed revenue.',
      evidence: ['Federal Reserve rate guidance — News Feed event linked', 'Mortgage conversions spiked 280% within 72 hours of announcement', 'Campaign hit daily budget cap by 2pm for 3 consecutive days', 'Budget pacing was at plan: $9.4K/day — no surge activated', 'Estimated missed conversions: 340 mortgage leads at ~$950 revenue/lead', 'Estimated missed revenue: $320K'],
      confidence: 85, impactEstimate: '-$320K missed revenue',
      recommendedAction: 'Create automated event-triggered budget surge rules: when mortgage-related conversions exceed 2x the 7-day average for 2+ consecutive days, automatically increase daily budget by 150% for up to 5 days.',
      status: 'new',
      actionSteps: [
        { id: 'step-8a', title: 'Create Budget Surge Rules', subtitle: 'AUTO-INCREASE MORTGAGE BUDGET 150% WHEN CONVERSIONS SPIKE 2X', type: 'budget', completed: false },
        { id: 'step-8b', title: 'Set Up Fed Event Alerts', subtitle: 'TRIGGER PROACTIVE BUDGET REVIEW 24HR BEFORE SCHEDULED RATE DECISIONS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'insight-portfolio-rebalance', createdAt: today, scope: 'brand', category: 'portfolio',
      channels: ['instagram', 'facebook', 'google-search', 'linkedin', 'ctv', 'ttd'],
      title: 'Portfolio ROAS Optimization Opportunity',
      summary: 'Moving $300K per month from Mass Market awareness (ROAS 1.4x, 84% saturated) to High-Net-Worth consideration (ROAS 4.2x, 41% saturated) would improve blended portfolio ROAS from 2.9x to an estimated 3.3x without increasing total spend. This reallocation crosses agency boundaries — In-House manages Mass Market brand campaigns, Publicis manages Wealth campaigns — so no single agency would ever recommend it. STRATIS sees the portfolio-level inefficiency and models the impact.',
      evidence: ['Mass Market: ROAS 1.4x, saturation 84%, marginal return declining', 'High-Net-Worth: ROAS 4.2x, saturation 41%, marginal return rising', 'Proposed shift: $300K/month from In-House (Mass Market) to Publicis (HNW)', 'Modeled portfolio ROAS improvement: 2.9x → 3.3x (+14%)', 'No single agency has visibility to recommend this cross-boundary reallocation'],
      confidence: 90, impactEstimate: '+$420K revenue/month',
      recommendedAction: 'Gradually shift $300K per month over 8 weeks: reduce In-House Game Day and Master Brand Mass Market targeting by 15%, and increase Publicis Roth IRA Season and HNW Wealth Advisory budgets.',
      status: 'new',
      actionSteps: [
        { id: 'step-9a', title: 'Reduce Mass Market Spend', subtitle: 'CUT GAME DAY AND MASTER BRAND MASS MARKET TARGETING BY 15%', type: 'budget', completed: false },
        { id: 'step-9b', title: 'Increase HNW Investment', subtitle: 'ADD $300K/MONTH TO ROTH IRA SEASON AND HNW ADVISORY CAMPAIGNS', type: 'budget', completed: false },
        { id: 'step-9c', title: 'Set Saturation Guard Rail', subtitle: 'PAUSE HNW SCALING IF SATURATION EXCEEDS 65%', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'insight-funnel-bottleneck', createdAt: yesterday, scope: 'brand', category: 'portfolio',
      channels: ['google-search', 'instagram', 'facebook', 'linkedin'],
      title: 'Full-Funnel Bottleneck Identified',
      summary: 'The Consideration → Application gate conversion rate dropped from 22.1% to 18.6% over the last 30 days — a 3.5 percentage point decline that is costing an estimated 1,200 lost applications per month. The bottleneck is concentrated in Mortgage and Self-Directed Investing conversion campaigns, while Sapphire and Freedom maintain healthy gate rates. Awareness and top-funnel metrics are strong — the problem is mid-funnel conversion, suggesting targeting or landing page issues rather than demand problems.',
      evidence: ['Consideration → Application gate rate: 18.6% (was 22.1% 30 days ago)', 'Drop concentrated in Mortgage Spring (-4.8pp) and Self-Directed Roth IRA (-3.2pp)', 'Sapphire and Freedom gate rates stable at 21-23%', 'Awareness and Consideration volumes unchanged — demand is healthy', 'Estimated lost applications from rate decline: ~1,200/month', 'At current rev/conv rates, this represents ~$1.8M in at-risk revenue'],
      confidence: 88, impactEstimate: '-$1.8M revenue at risk',
      recommendedAction: 'Reduce bid pressure on Mortgage and Self-Directed conversion campaigns by 10% until the mid-funnel issue is diagnosed. Reallocate the saved budget to consideration-stage campaigns for the same products to build a healthier pipeline.',
      status: 'new',
      actionSteps: [
        { id: 'step-10a', title: 'Reduce Conversion Campaign Bids', subtitle: 'LOWER MORTGAGE AND SELF-DIRECTED CONVERSION BIDS BY 10%', type: 'bidding', completed: false },
        { id: 'step-10b', title: 'Boost Consideration Pipeline', subtitle: 'INCREASE MORTGAGE AND SELF-DIRECTED CONSIDERATION BUDGETS BY 20%', type: 'budget', completed: false },
        { id: 'step-10c', title: 'Landing Page Audit', subtitle: 'INITIATE UX REVIEW OF MORTGAGE AND SELF-DIRECTED APPLICATION FLOWS', type: 'creative', completed: false },
      ],
    },
  ];
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
    division: def.division,
    agency: def.agency,
    productLine: def.productLine,
    audiences: def.audiences,
    objective: def.objective,
    status: def.status,
    channels: def.channels,
    geos: def.geos,
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
