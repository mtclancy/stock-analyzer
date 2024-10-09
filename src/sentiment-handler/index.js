"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const axios_1 = __importDefault(require("axios"));
const open_ai_client_1 = require("./open-ai/open-ai.client");
const uuid_1 = require("uuid");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_client_1 = require("../dynamodb/dynamodb-client");
function handler(event) {
    return __awaiter(this, void 0, void 0, function* () {
        const generalInformation = yield getCompanyInformation(event.ticker);
        const newsAndSentiment = yield getNewsAndSentiment(event.ticker);
        const newsSummary = yield summarizeSentiment(newsAndSentiment);
        const stockAnalysis = yield analyzeStockWithAssistant(generalInformation, newsSummary !== null && newsSummary !== void 0 ? newsSummary : '');
        if (stockAnalysis) {
            yield writeAnalysisToDb(stockAnalysis, event.groupId);
        }
    });
}
function getCompanyInformation(ticker) {
    return __awaiter(this, void 0, void 0, function* () {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${process.env['ALPHA_KEY']}`,
            headers: {}
        };
        const result = yield axios_1.default.request(config);
        return result.data;
    });
}
function getNewsAndSentiment(ticker) {
    return __awaiter(this, void 0, void 0, function* () {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&apikey=${process.env['ALPHA_KEY']}`,
            headers: {}
        };
        const result = yield axios_1.default.request(config);
        return result.data;
    });
}
function summarizeSentiment(newsFeed) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            messages: [{ role: 'user', content: `summarize the following market news and sentiment about the following company from the Alpha Vantage API: ${JSON.stringify(newsFeed)}` }],
            model: 'gpt-4o-mini',
            n: 1,
            max_completion_tokens: 1000
        };
        const chatCompletion = yield open_ai_client_1.openAiClient.chat.completions.create(params);
        return chatCompletion.choices[0].message.content;
    });
}
function analyzeStock(generalInformation, newsSummary) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            messages: [{ role: 'user', content: `I have provided general stock information about a company and a summary of news and sentiment surrounding the company.  Do you feel it is a strong stock to buy based on this information?  General Information: ${JSON.stringify(generalInformation)}, News and Sentiment: ${newsSummary}` }],
            model: 'gpt-4o-mini',
            n: 1,
            max_completion_tokens: 1000
        };
        const chatCompletion = yield open_ai_client_1.openAiClient.chat.completions.create(params);
        return chatCompletion.choices[0].message.content;
    });
}
function analyzeStockWithAssistant(generalInformation, newsSummary) {
    return __awaiter(this, void 0, void 0, function* () {
        const thread = yield open_ai_client_1.openAiClient.beta.threads.create();
        let run = yield open_ai_client_1.openAiClient.beta.threads.runs.createAndPoll(thread.id, {
            assistant_id: 'asst_g4VrccnfrR4sgLZo1zkdtwzj',
            instructions: `I have provided general stock information about a company and a summary of news and sentiment surrounding the company.  Do you feel it is a strong stock to buy based on this information?  General Information: ${JSON.stringify(generalInformation)}, News and Sentiment: ${newsSummary}`
        });
        return yield getMessageFromAssistant(run);
    });
}
function getMessageFromAssistant(run) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('checking');
        if (run.status === 'completed') {
            const messages = yield open_ai_client_1.openAiClient.beta.threads.messages.list(run.thread_id);
            for (const message of messages.data.reverse()) {
                if (message.content[0].type === 'text') {
                    return message.content[0].text.value;
                }
            }
        }
        else {
            yield wait(5000);
            getMessageFromAssistant(run);
        }
    });
}
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function writeAnalysisToDb(stockAnalysis, groupId) {
    return __awaiter(this, void 0, void 0, function* () {
        const putCommand = new lib_dynamodb_1.PutCommand({
            TableName: process.env['ANALYSIS_TABLE_NAME'],
            Item: {
                id: (0, uuid_1.v4)(),
                analysis: stockAnalysis,
                groupId: groupId
            }
        });
        yield dynamodb_client_1.dynamodbClient.send(putCommand);
    });
}
