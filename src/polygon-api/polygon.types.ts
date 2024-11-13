interface PolygonAggregateApiResponse {
    adjusted: boolean;
    next_url: string;
    queryCount: number;
    request_id: string;
    results: AggregateResult[];
    resultsCount: number;
    status: string;
    ticker: string;
  }
  
  interface AggregateResult {
    c: number;   // Closing price
    h: number;   // High price
    l: number;   // Low price
    n: number;   // Number of trades
    o: number;   // Opening price
    t: number;   // Timestamp (in milliseconds)
    v: number;   // Volume traded
    vw: number;  // Volume-weighted average price
  }

  interface FinancialResponse {
    count: number;
    next_url: string;
    request_id: string;
    results: FinancialResult[];
    status: string;
  }
  
  interface FinancialResult {
    cik: string;
    company_name: string;
    end_date: string;
    filing_date: string;
    financials: Financials;
    fiscal_period: string;
    fiscal_year: string;
    source_filing_file_url: string;
    source_filing_url: string;
    start_date: string;
  }
  
  interface Financials {
    income_statement: IncomeStatement;
  }
  
  interface IncomeStatement {
    basic_earnings_per_share: FinancialMetric;
    benefits_costs_expenses: FinancialMetric;
    cost_of_revenue: FinancialMetric;
    costs_and_expenses: FinancialMetric;
    diluted_earnings_per_share: FinancialMetric;
    gross_profit: FinancialMetric;
    income_loss_from_continuing_operations_after_tax: FinancialMetric;
    income_loss_from_continuing_operations_before_tax: FinancialMetric;
    income_tax_expense_benefit: FinancialMetric;
    interest_expense_operating: FinancialMetric;
    net_income_loss: FinancialMetric;
    net_income_loss_attributable_to_noncontrolling_interest: FinancialMetric;
    net_income_loss_attributable_to_parent: FinancialMetric;
    net_income_loss_available_to_common_stockholders_basic: FinancialMetric;
    operating_expenses: FinancialMetric;
    operating_income_loss: FinancialMetric;
    participating_securities_distributed_and_undistributed_earnings_loss_basic: FinancialMetric;
    preferred_stock_dividends_and_other_adjustments: FinancialMetric;
    revenues: FinancialMetric;
  }
  
  interface FinancialMetric {
    label: string;
    order: number;
    unit: string;
    value: number;
  }
  