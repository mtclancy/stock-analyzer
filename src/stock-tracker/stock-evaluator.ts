import { sheets_v4 } from "googleapis";
import axios, { AxiosRequestConfig } from "axios";
import { EPSReport, RevenueReport } from "../alpha-advantage/alpha.types";
import { GetParameterCommand, GetParameterCommandInput } from "@aws-sdk/client-ssm";
import { ssmClient } from "../ssm/ssm-client";
import { getSheetsClient } from "../google-sheets/google-sheets";
import { format, subMonths, subDays } from "date-fns";
interface RowData {
    highPE: number;
    lowPE: number;
    averageLowPrice: number;
    averageHighPrice: number;
    currentPrice: number;
    earnings: Array<number | string>;
    revenue: number[];
}

let sheets: sheets_v4.Sheets;

export async function stockEvaluator() {
    // const alphaKey = await getAlphaKey();
    sheets = await getSheetsClient();

    const sheetId = '1lxuGia3zCTjD7GXupwdR2PvarMr6jiZXpzGrV9uUV3o';
    const sheetInput: sheets_v4.Params$Resource$Spreadsheets$Values$Get = {
        spreadsheetId: sheetId,
        range: 'Sheet2!A2:K15'
    }
    const stockSheet = await sheets.spreadsheets.values.get(sheetInput);
   
    if(stockSheet.data.values) {
        for(const [index, rowValues] of stockSheet.data.values?.entries()) {
            const indexesToSkip = findIndexesToSkip(rowValues);
            const rowNumber = index + 2;
            const [highAverage, lowAverage, currentPrice] = await getHistoricalHighAndLowAverages(rowValues[0].toUpperCase(), 'Ydf3nb279Kqbsx6adcyl6iBobrDhkZ_T');
            const {epsForLastFiveYears, revenueOfLastFiveYears} = await getEarnings(rowValues[0].toUpperCase(), indexesToSkip, 'Ydf3nb279Kqbsx6adcyl6iBobrDhkZ_T')
            const averageEPS: number = getAverageEps(epsForLastFiveYears);
            const rowData: RowData = {
                highPE: highAverage / averageEPS,
                lowPE: lowAverage / averageEPS,
                averageLowPrice: lowAverage,
                averageHighPrice: highAverage,
                currentPrice,
                earnings: epsForLastFiveYears.map(e => e.reportedEPS),
                revenue: revenueOfLastFiveYears.map(r => r.totalRevenue)
            }

            await updateSpreadsheet(sheetId, rowValues[0], rowData, rowNumber);
        }
    }
}

async function getAlphaKey(): Promise<string> {
    const parameterInput: GetParameterCommandInput = {
        Name:"stock-data-load-key",
        WithDecryption: true,
      };
    
      const parameterCommand = new GetParameterCommand(parameterInput);
      const alphaKeyResult = await ssmClient.send(parameterCommand);
      const alphaKey = alphaKeyResult.Parameter
      if(!alphaKey || !alphaKey.Value) {
        throw new Error("no alpha key")
      }

      return alphaKey.Value
}

function findIndexesToSkip(values: string[]): number[] {
    const indexesToSkip: number[] = [];
    values.forEach((v: string, index: number) => {
        if(v === 'x') {
            indexesToSkip.push(index - 1);
        }
    })
    return indexesToSkip
}

async function getHistoricalHighAndLowAverages(ticker: string, polygonKey: string): Promise<[number, number, number]> {
    const {start, end} = getStockDateRange();
   
    let config: AxiosRequestConfig = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/month/${end}/${start}?adjusted=true&sort=asc&apiKey=${polygonKey}`,
        headers: { }
      };
      
    const apiResponse: PolygonAggregateApiResponse = await (await axios.request(config)).data
    // const monthlySeries = getMonthlyTimeSeriesArray(result.data['Monthly Time Series']);
    const [highPriceAverage, lowPriceAverage] = getHighAndLowAverages(apiResponse.results);
    const lastIndex = apiResponse.results.length - 1;
    const currentPrice = Number(apiResponse.results[lastIndex].c)
    return [highPriceAverage, lowPriceAverage, currentPrice];
  }

  async function getEarnings(ticker: string, indexesToSkip: number[], polygonKey: string): Promise<{epsForLastFiveYears: EPSReport[], revenueOfLastFiveYears: RevenueReport[]}> {
    const {end} = getStockDateRange();

    let config: AxiosRequestConfig = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&filing_date.gte=${end}&timeframe=annual&limit=10&apiKey=${polygonKey}`,
        headers: { }
    };
    
    const result: FinancialResponse = (await axios.request(config)).data;

    const epsForLastFiveYears: EPSReport[] = result.results.map(r => ({
        reportedEPS: r.financials.income_statement.diluted_earnings_per_share ? Number(r.financials.income_statement.diluted_earnings_per_share.value) : 'x',
        fiscalDateEnding: r.end_date
    }));
    epsForLastFiveYears.reverse();
    
    indexesToSkip.forEach((i) => {
        epsForLastFiveYears[i].reportedEPS = 'x'
    })

    const revenueOfLastFiveYears: RevenueReport[] = result.results.map(r => ({
        totalRevenue: Number(r.financials.income_statement.revenues.value / 1000000)
    }))

    return {epsForLastFiveYears, revenueOfLastFiveYears};
  }

function getAverageEps(epsForLastFiveYears: EPSReport[]): number {
    const filteredArray = epsForLastFiveYears.filter(eps => eps.reportedEPS !== 'x');
    const sumOfEps = filteredArray.reduce((sum: number, eps: EPSReport) => sum + Number(eps.reportedEPS), 0)
    return sumOfEps / filteredArray.length;
}

async function updateSpreadsheet(sheetId: string, symbol: string, rowData: RowData, row: number) {
    console.log(rowData)
    const range = `Sheet2!A${row}:P${row}`;
    const requestBody: sheets_v4.Params$Resource$Spreadsheets$Values$Update ={
        spreadsheetId: sheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values: [[
            symbol,
            rowData.earnings[0] ? rowData.earnings[0]: '',
            rowData.earnings[1] ? rowData.earnings[1]: '',
            rowData.earnings[2] ? rowData.earnings[2]: '',
            rowData.earnings[3] ? rowData.earnings[3]: '',
            rowData.earnings[4] ? rowData.earnings[4]: '',
            rowData.revenue[4] ? rowData.revenue[4] : '',
            rowData.revenue[3] ? rowData.revenue[3] : '',
            rowData.revenue[2] ? rowData.revenue[2] : '',
            rowData.revenue[1] ? rowData.revenue[1] : '',
            rowData.revenue[0] ? rowData.revenue[0] : '',
            rowData.lowPE,
            rowData.highPE,
            rowData.averageLowPrice,
            rowData.averageHighPrice,
            rowData.currentPrice
            ]]}
    }
    
    await sheets.spreadsheets.values.update(requestBody);
}

function getHighAndLowAverages(monthlySeries: AggregateResult[]): [number, number] {
    const highSum = monthlySeries.reduce((sum: number, series: AggregateResult) => sum + Number(series.h), 0);
    const lowSum = monthlySeries.reduce((sum: number, series: AggregateResult) => sum + Number(series.l), 0);

    return [highSum / monthlySeries.length, lowSum / monthlySeries.length];
}

function getStockDateRange(): { start: string; end: string; } {
    const yesterday = subDays(new Date(), 1);
    const start = format(yesterday, 'yyyy-MM-dd');
    const sixtyMonthsAgo = subMonths(yesterday, 60);
    const end = format(sixtyMonthsAgo, 'yyyy-MM-dd');
    return {start, end}
}

