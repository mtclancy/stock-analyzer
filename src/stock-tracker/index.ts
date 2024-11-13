import { sheets_v4 } from "googleapis";
import axios, { AxiosRequestConfig } from "axios";
import { CurrentPrice, GeneralStockData } from "../alpha-advantage/alpha.types";
import { GetParameterCommand, GetParameterCommandInput } from "@aws-sdk/client-ssm";
import { ssmClient } from "../ssm/ssm-client";
import { getSheetsClient } from "../google-sheets/google-sheets";


interface RowDef {
    Ticker: string;
    Name: string;
    EPS: number;
    P_E: number;
    Target_Price: number;
    Strong_Buy: number;
    Buy: number;
    Hold: number;
    Sell: number;
    Strong_Sell: number;
}

let sheets: sheets_v4.Sheets;
export async function dataLoaderHandler() {
    // const alphaKey = await getAlphaKey();
    sheets = await getSheetsClient();

    const sheetId = '1lxuGia3zCTjD7GXupwdR2PvarMr6jiZXpzGrV9uUV3o';
    const sheetInput: sheets_v4.Params$Resource$Spreadsheets$Values$Get = {
        spreadsheetId: sheetId,
        range: 'Sheet1!A2:A15'
    }
    const stockSheet = await sheets.spreadsheets.values.get(sheetInput);
   
    if(stockSheet.data.values) {
        for(const [index, rowValues] of stockSheet.data.values?.entries()) {
            const rowNumber = index + 2;
            const currentPrice: CurrentPrice = await getCurrentPrice(rowValues[0].toUpperCase(), 'DINRKZ8U2YWAC795');
            const generalInformation: GeneralStockData = await getCompanyInformation(rowValues[0].toUpperCase(), 'DINRKZ8U2YWAC795');
            await updateSpreadsheet(sheetId, currentPrice, generalInformation, rowNumber);
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

async function getCurrentPrice(ticker: string, alphaKey: string): Promise<CurrentPrice> {
    let config: AxiosRequestConfig = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${alphaKey}`,
        headers: { }
      };
      
    const result = await axios.request(config)
    const firstKey = Object.keys(result.data['Time Series (Daily)'])[0];
    return result.data['Time Series (Daily)'][firstKey];
  }
  
  async function getCompanyInformation(ticker: string, alphaKey: string): Promise<GeneralStockData> {
      let config: AxiosRequestConfig = {
          method: 'get',
          maxBodyLength: Infinity,
          url: `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${alphaKey}`,
          headers: { }
        };
        
      const result = await axios.request(config)
      
      return result.data;
  }

async function updateSpreadsheet(sheetId: string, currentPrice: CurrentPrice, generalInformation: GeneralStockData, row: number) {
    const range = `Sheet1!A${row}:M${row}`;
    const requestBody: sheets_v4.Params$Resource$Spreadsheets$Values$Update ={
        spreadsheetId: sheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values: [[
            generalInformation.Symbol,
            generalInformation.Name,
            currentPrice["2. high"],
            currentPrice["4. close"],
            generalInformation.EPS,
            generalInformation.PERatio,
            generalInformation.ForwardPE,
            generalInformation.AnalystTargetPrice,
            generalInformation.AnalystRatingStrongBuy,
            generalInformation.AnalystRatingBuy,
            generalInformation.AnalystRatingHold,
            generalInformation.AnalystRatingSell,
            generalInformation.AnalystRatingStrongSell
            ]]}
    }
    
    await sheets.spreadsheets.values.update(requestBody);
}
