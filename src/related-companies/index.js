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
const sfnClient_1 = require("../stepFunction/sfnClient");
const client_sfn_1 = require("@aws-sdk/client-sfn");
const uuid_1 = require("uuid");
function handler(event) {
    return __awaiter(this, void 0, void 0, function* () {
        const ticker = event.queryStringParameters && event.queryStringParameters['ticker'] ?
            event.queryStringParameters['ticker'] : null;
        if (ticker) {
            const uuid = (0, uuid_1.v4)();
            const relatedCompanies = yield getRelatedCompanies(ticker);
            const stateMachinePayload = relatedCompanies.results.map(r => ({ ticker: r.ticker, groupId: uuid }));
            yield startStateMachine(stateMachinePayload);
        }
        return {
            statusCode: 200,
            body: ""
        };
    });
}
function getRelatedCompanies(ticker) {
    return __awaiter(this, void 0, void 0, function* () {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://api.polygon.io/v1/related-companies/${ticker}?apiKey=${process.env['POLYGON_API_KEY']}`,
            headers: {}
        };
        const result = yield axios_1.default.request(config);
        return result.data;
    });
}
function startStateMachine(results) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = new client_sfn_1.StartExecutionCommand({
            stateMachineArn: process.env['STATE_MACHINE_ARN'],
            input: JSON.stringify(results) // This is the input to the Map state
        });
        yield sfnClient_1.sfnClient.send(params);
    });
}
