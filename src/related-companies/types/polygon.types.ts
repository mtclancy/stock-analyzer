export interface RelatedCompaniesResponse {
    request_id: string;
    results: [{
        ticker: string;
    }],
    status: string;
    stock_symbol: string;
}