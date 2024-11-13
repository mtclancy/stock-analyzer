export interface GeneralStockData {
  Symbol: string;
  AssetType: string;
  Name: string;
  Description: string;
  CIK: string;
  Exchange: string;
  Currency: string;
  Country: string;
  Sector: string;
  Industry: string;
  Address: string;
  OfficialSite: string;
  FiscalYearEnd: string;
  LatestQuarter: string;
  MarketCapitalization: string;
  EBITDA: string;
  PERatio: string;
  PEGRatio: string;
  BookValue: string;
  DividendPerShare: string;
  DividendYield: string;
  EPS: string;
  RevenuePerShareTTM: string;
  ProfitMargin: string;
  OperatingMarginTTM: string;
  ReturnOnAssetsTTM: string;
  ReturnOnEquityTTM: string;
  RevenueTTM: string;
  GrossProfitTTM: string;
  DilutedEPSTTM: string;
  QuarterlyEarningsGrowthYOY: string;
  QuarterlyRevenueGrowthYOY: string;
  AnalystTargetPrice: string;
  AnalystRatingStrongBuy: number;
  AnalystRatingBuy: number;
  AnalystRatingHold: number;
  AnalystRatingSell: number;
  AnalystRatingStrongSell: number;
  TrailingPE: string;
  ForwardPE: string;
  PriceToSalesRatioTTM: string;
  PriceToBookRatio: string;
  EVToRevenue: string;
  EVToEBITDA: string;
  Beta: string;
  FiftyTwoWeekHigh: string;
  FiftyTwoWeekLow: string;
  FiftyDayMovingAverage: string;
  TwoHundredDayMovingAverage: string;
  SharesOutstanding: string;
  DividendDate: string;
  ExDividendDate: string;
}

export interface TickerSentiment {
  ticker: string;
  relevance_score: string;
  ticker_sentiment_score: string;
  ticker_sentiment_label: string;
}

export interface Topic {
  topic: string;
  relevance_score: string;
}

export interface FeedItem {
  title: string;
  url: string;
  time_published: string;
  authors: string[];
  summary: string;
  banner_image: string;
  source: string;
  category_within_source: string;
  source_domain: string;
  topics: Topic[];
  overall_sentiment_score: number;
  overall_sentiment_label: string;
  ticker_sentiment: TickerSentiment[];
}
export interface NewsFeed {
  items: string;
  sentiment_score_definition: string;
  relevance_score_definition: string;
  feed: FeedItem[];
}

export interface CurrentPrice {
  "1. open": number,
  "2. high": number,
  "3. low": number,
  "4. close": number,
  "5. volume": number
}

export interface EPSReport {
  fiscalDateEnding: string;
  reportedEPS: number | string;
}

export interface RevenueReport {
  totalRevenue: number;
}