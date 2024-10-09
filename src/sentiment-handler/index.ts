import axios, { AxiosRequestConfig } from "axios";
import OpenAI from "openai";

import { Run } from "openai/resources/beta/threads/runs/runs";
import { v4 as uuidv4 } from 'uuid';
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamodbClient } from "../dynamodb/dynamodb-client";
import { GetParametersCommand, GetParametersCommandInput, Parameter } from "@aws-sdk/client-ssm";
import { ssmClient } from "../ssm/ssm-client";
import { getOpenAiClient } from "./open-ai/open-ai.client";

let openAiClient: OpenAI;

export async function handler(event: {ticker: string, groupId: string}) {
    const { alphaKey, openAiKey} = await getKeys();
    openAiClient = getOpenAiClient(openAiKey);
    const generalInformation: GeneralStockData = await getCompanyInformation(event.ticker, alphaKey);
    const newsAndSentiment: NewsFeed = await getNewsAndSentiment(event.ticker, alphaKey);
    const newsSummary = await summarizeSentiment(newsAndSentiment, openAiKey)

    const stockAnalysis = await analyzeStockWithAssistant(generalInformation, newsSummary ?? '');
    if(stockAnalysis){
      await writeAnalysisToDb(stockAnalysis, event.groupId)
    }
    
}

async function getKeys(): Promise<{ alphaKey: string, openAiKey: string}> {
  const parameterInput: GetParametersCommandInput = {
    Names: [
      "open-ai-key",
      "alpha-key"
    ],
    WithDecryption: true,
  };
  const parameterCommand = new GetParametersCommand(parameterInput);
  const keys = await ssmClient.send(parameterCommand);
  const alphaKey = keys.Parameters?.find(k => k.Name === 'alpha-key');
  const openAiKey = keys.Parameters?.find(k => k.Name === 'open-ai-key')
  if((!alphaKey || !alphaKey.Value) || (!openAiKey || !openAiKey.Value)) {
    throw new Error("API keys missing")
  }
  return {
    alphaKey: alphaKey.Value,
    openAiKey: openAiKey.Value
  }
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

async function summarizeSentiment(newsFeed: NewsFeed, openAiKey: string) {
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

async function analyzeStockWithAssistant(generalInformation: GeneralStockData, newsSummary: string) {
    const thread = await openAiClient.beta.threads.create();
    let run = await openAiClient.beta.threads.runs.createAndPoll(
        thread.id,
        { 
          assistant_id: 'asst_g4VrccnfrR4sgLZo1zkdtwzj',
          instructions: `I have provided general stock information about a company and a summary of news and sentiment surrounding the company.  Do you feel it is a strong stock to buy based on this information?  General Information: ${JSON.stringify(generalInformation)}, News and Sentiment: ${newsSummary}`
        }
      );
    return await getMessageFromAssistant(run);
}

async function getMessageFromAssistant(run: Run) {
    console.log('checking')
    if (run.status === 'completed') {
        const messages = await openAiClient.beta.threads.messages.list(
          run.thread_id
        );
        for (const message of messages.data.reverse()) {
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


async function writeAnalysisToDb(stockAnalysis: string, groupId: string) {

  const putCommand = new PutCommand({
    TableName: process.env['ANALYSIS_TABLE_NAME'],
    Item: {
      id: uuidv4(),
      analysis: stockAnalysis,
      groupId: groupId
    }
  })

  await dynamodbClient.send(putCommand);
}

