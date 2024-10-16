import axios, { AxiosRequestConfig } from "axios";
import OpenAI from "openai";

import { Run } from "openai/resources/beta/threads/runs/runs";
import { v4 as uuidv4 } from 'uuid';
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodbClient } from "../dynamodb/dynamodb-client";
import { GetParameterCommand, GetParameterCommandInput} from "@aws-sdk/client-ssm";
import { ssmClient } from "../ssm/ssm-client";
import { getOpenAiClient } from "./open-ai/open-ai.client";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";

let openAiClient: OpenAI;

interface AnalysisEvent {
  email: string
  ticker: string;
  groupId: string;
}

interface CurrentPrice {
  "1. open": number,
  "2. high": number,
  "3. low": number,
  "4. close": number,
  "5. volume": number
}

export async function handler(event: AnalysisEvent) {
    const { alphaKey, openAiKey} = await getKeys(event.email);
    openAiClient = getOpenAiClient(openAiKey);
    const generalInformation: GeneralStockData = await getCompanyInformation(event.ticker, alphaKey);
    const newsAndSentiment: NewsFeed = await getNewsAndSentiment(event.ticker, alphaKey);
    const currentPrice: CurrentPrice = await getCurrentPrice(event.ticker, alphaKey);
    const newsSummary = await summarizeSentiment(newsAndSentiment)

    const stockAnalysis = await analyzeStockWithAssistant(generalInformation, newsSummary ?? '', currentPrice);
    if(stockAnalysis){
      await writeAnalysisToDb(stockAnalysis, event)
    }
    return 'done'
    
}

async function getKeys(email: string): Promise<{ alphaKey: string, openAiKey: string}> {
  const alphaKeyResult = await getAlphaKey(email);

  const parameterInput: GetParameterCommandInput = {
    Name:"open-ai-key",
    WithDecryption: true,
  };

  const parameterCommand = new GetParameterCommand(parameterInput);
  const openAiKeyResult = await ssmClient.send(parameterCommand);
  const alphaKey = alphaKeyResult.Item?.alphaKey.S;
  const openAiKey = openAiKeyResult.Parameter
  
  if((!alphaKey) || (!openAiKey || !openAiKey.Value)) {
    throw new Error("API keys missing")
  }
  
  return {
    alphaKey: alphaKey,
    openAiKey: openAiKey.Value
  }
}
async function getAlphaKey(email: string) {
  const getAlphaKey: GetItemCommand = new GetItemCommand({
    Key: { id: { S: email } },
    TableName: 'user-table'
  });

  const alphaKeyResult = await dynamodbClient.send(getAlphaKey);
  return alphaKeyResult;
}

async function getCurrentPrice(ticker: string, alphaKey: string) {
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

async function getCompanyInformation(ticker: string, alphaKey: string) {
    let config: AxiosRequestConfig = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${alphaKey}`,
        headers: { }
      };
      
    const result = await axios.request(config)
    
    return result.data;
}

async function getNewsAndSentiment(ticker: string, alphaKey: string) {
    let config: AxiosRequestConfig = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&apikey=${alphaKey}`,
        headers: { }
      };
      
    const result = await axios.request(config)
    
    return result.data;
}

async function summarizeSentiment(newsFeed: NewsFeed) {
    const params: OpenAI.Chat.ChatCompletionCreateParams = {
        messages: [{ role: 'user', content: `summarize the following market news and sentiment about the following company from the Alpha Vantage API: ${JSON.stringify(newsFeed)}` }],
        model: 'gpt-4o-mini',
        n: 1,
        max_completion_tokens: 1000
      };
      const chatCompletion: OpenAI.Chat.ChatCompletion = await openAiClient.chat.completions.create(params);

      return chatCompletion.choices[0].message.content;
}

async function analyzeStock(generalInformation: GeneralStockData, newsSummary: string) {
    const params: OpenAI.Chat.ChatCompletionCreateParams = {
        messages: [{ role: 'user', content: `I have provided general stock information about a company and a summary of news and sentiment surrounding the company.  Do you feel it is a strong stock to buy based on this information?  General Information: ${JSON.stringify(generalInformation)}, News and Sentiment: ${newsSummary}` }],
        model: 'gpt-4o-mini',
        n: 1,
        max_completion_tokens: 1000
      };
      const chatCompletion: OpenAI.Chat.ChatCompletion = await openAiClient.chat.completions.create(params);

      return chatCompletion.choices[0].message.content;
}

async function analyzeStockWithAssistant(generalInformation: GeneralStockData, newsSummary: string, currentPrice: CurrentPrice, ) {
    const content = `Ticker: ${generalInformation.Symbol}, General Information: ${JSON.stringify(generalInformation)}, Current Price: ${JSON.stringify(currentPrice)},News and Sentiment: ${newsSummary}`;
    const thread = await openAiClient.beta.threads.create({
      messages: [
        {
          role: "user",
          content
        }
      ]
    });
    
    let run = await openAiClient.beta.threads.runs.createAndPoll(
        thread.id,
        { 
          assistant_id: 'asst_g4VrccnfrR4sgLZo1zkdtwzj'
        }
      );
    return await getMessageFromAssistant(run);
}

async function getMessageFromAssistant(run: Run) {
    if (run.status === 'completed') {
        const messages = await openAiClient.beta.threads.messages.list(
          run.thread_id
        );
        for (const message of messages.data) {
          if(message.content[0].type === 'text') {
            return message.content[0].text.value
          }
        }
      } else {
        await wait(5000);
        getMessageFromAssistant(run)
      }
}

function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function writeAnalysisToDb(stockAnalysis: string, event: AnalysisEvent) {

  const putCommand = new PutCommand({
    TableName: process.env['ANALYSIS_TABLE_NAME'],
    Item: {
      id: uuidv4(),
      analysis: stockAnalysis,
      groupId: event.groupId,
      ticker: event.ticker
    }
  })

  await dynamodbClient.send(putCommand);
}

