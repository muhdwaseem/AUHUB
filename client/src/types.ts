export interface QualityRow {
  quality: string;
  grams: number;
  value: number;
  avgRate: number;
}

export interface PeriodSummary {
  date: string | null;
  goldBoughtGrams: number;
  goldBoughtValue: number;
  avgBuyRate: number;
  goldSoldGrams: number;
  goldSoldValue: number;
  avgSellRate: number;
  cogs: number;
  stockLeftGrams: number;
  stockLeftValue: number;
  grossProfit: number;
  totalExpenses: number;
  sharedExpenses: number;
  chargedExpenses: number;
  commonNetProfit: number;
  netProfit: number;
  totalLoss: number;
  netLoss: number;
  chargedByInvestor: Record<string, number>;
  buyByQuality: QualityRow[];
  sellByQuality: QualityRow[];
}

export interface PartnerShareRow {
  name: string;
  role: string | null;
  percentage: number;
  share: number;
}

export interface InvestorSplitRow {
  investorId: string;
  name: string;
  sharePercentage: number;
  grossShare: number;
  sharedExpenseShare: number;
  chargedExpenses: number;
  grossMemberShare: number;
  companyCutPct: number;
  companyCut: number;
  netShare: number;
  netLossShare: number;
  partnerSplit: PartnerShareRow[];
}

export interface Team {
  id: string;
  name: string;
  companyCutPct: number;
  createdAt: string;
  counts?: { investors: number; transactions: number; expenses: number };
}

export interface TeamOverviewRow {
  teamId: string;
  name: string;
  companyCutPct: number;
  investors: number;
  totalCapital: number;
  grossProfit: number;
  netProfit: number;
  netLoss: number;
  stockLeftGrams: number;
  stockLeftValue: number;
  companyEarnings: number;
}

export interface ProfitPartner {
  id: string;
  name: string;
  role: string | null;
  percentage: number;
}

export interface ReportSummary {
  overall: PeriodSummary;
  daily: PeriodSummary[];
  generatedAt: string;
  teamId: string | null;
  teamName: string | null;
  investorSplit: InvestorSplitRow[];
  dailyInvestorSplit: { date: string; rows: InvestorSplitRow[] }[];
  companyEarnings: number;
  expensesByCategory: { name: string; amount: number }[];
  expensesByInvestor: { name: string; charged: number; tagged: number }[];
  totalActiveShare: number;
  counts: { investors: number; transactions: number; expenses: number };
}

export interface Investor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  teamId: string | null;
  sharePercentage: number;
  capitalInvested: number;
  currencyCode: string;
  fxRate: number;
  /** the member's own override, or null to inherit the team default */
  companyCutPct: number | null;
  /** resolved: override, else the team default */
  effectiveCompanyCutPct: number;
  teamCompanyCutPct: number;
  partners: ProfitPartner[];
  status: "ACTIVE" | "INACTIVE";
  notes: string | null;
  joinedAt: string;
  loginStatus: "ACTIVE" | "INVALID" | null;
  username: string | null;
  generatedUsername: string | null;
  generatedPassword: string | null;
}

/** One leg of a multi-step currency conversion (e.g. THB -> USDT -> AED) —
 *  a paper trail attached to a trade or expense, purely for reference. */
export interface ConversionHop {
  id: string;
  order: number;
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAmount: number;
  /** toAmount / fromAmount, server-derived. */
  rate: number;
  date: string;
  notes: string | null;
}

export interface GoldTxn {
  id: string;
  type: "BUY" | "SELL";
  teamId: string | null;
  date: string;
  quality: string;
  quantityGrams: number;
  ratePerGram: number;
  totalAmount: number;
  currencyCode: string;
  fxRate: number;
  counterparty: string | null;
  notes: string | null;
  hops: ConversionHop[];
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  categoryName: string;
  teamId: string | null;
  amount: number;
  currencyCode: string;
  fxRate: number;
  date: string;
  description: string | null;
  createdAt: string;
  investorId: string | null;
  investorName: string | null;
  chargedToInvestor: boolean;
  hops: ConversionHop[];
  attachments: Attachment[];
}

export interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  expenseCount: number;
}

export interface PortalPeriod {
  date: string | null;
  goldBoughtGrams: number;
  goldBoughtValue: number;
  goldSoldGrams: number;
  goldSoldValue: number;
  stockLeftGrams: number;
  stockLeftValue: number;
  grossProfit: number;
  totalExpenses: number;
  sharedExpenses: number;
  chargedExpensesTotal: number;
  netProfit: number;
  myGrossShare: number;
  mySharedExpenseShare: number;
  myChargedExpenses: number;
  companyCutPct: number;
  myCompanyCut: number;
  myNetShare: number;
  totalLoss: number;
  netLoss: number;
  myNetLossShare: number;
}

export interface PortalSummary {
  investor: {
    name: string;
    sharePercentage: number;
    capitalInvested: number;
    joinedAt: string;
    teamName: string | null;
    companyCutPct: number;
  };
  overall: PortalPeriod & {
    buyByQuality: QualityRow[];
    sellByQuality: QualityRow[];
    partnerSplit: PartnerShareRow[];
  };
  daily: PortalPeriod[];
  generatedAt: string;
}

export interface Currency {
  rate: number;
  rateUpdatedAt: string | null;
  id: string;
  code: string;
  symbol: string;
  decimals: number;
  isBase: boolean;
  createdAt: string;
}

/** One currency's rate as resolved for a specific date (see GET /currencies/rates-on). */
export interface CurrencyRateOn {
  code: string;
  rate: number;
  /** The date this rate actually came from — earlier than the query date when
   *  that exact day had no saved rate yet (nearest-earlier-date fallback). */
  resolvedDate: string | null;
  /** false when resolvedDate !== the requested date (a fallback, not an exact hit). */
  exact: boolean;
}
