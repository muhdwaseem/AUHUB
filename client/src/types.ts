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
  netShare: number;
  netLossShare: number;
  partnerSplit: PartnerShareRow[];
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
  investorSplit: InvestorSplitRow[];
  dailyInvestorSplit: { date: string; rows: InvestorSplitRow[] }[];
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
  sharePercentage: number;
  capitalInvested: number;
  currencyCode: string;
  fxRate: number;
  partners: ProfitPartner[];
  status: "ACTIVE" | "INACTIVE";
  notes: string | null;
  joinedAt: string;
  loginStatus: "ACTIVE" | "INVALID" | null;
  username: string | null;
  generatedUsername: string | null;
  generatedPassword: string | null;
}

export interface GoldTxn {
  id: string;
  type: "BUY" | "SELL";
  date: string;
  quality: string;
  quantityGrams: number;
  ratePerGram: number;
  totalAmount: number;
  currencyCode: string;
  fxRate: number;
  counterparty: string | null;
  notes: string | null;
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
  amount: number;
  currencyCode: string;
  fxRate: number;
  date: string;
  description: string | null;
  createdAt: string;
  investorId: string | null;
  investorName: string | null;
  chargedToInvestor: boolean;
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
