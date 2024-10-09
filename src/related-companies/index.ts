import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios, { AxiosRequestConfig } from "axios";
import { RelatedCompaniesResponse } from "./types/polygon.types";
import { sfnClient } from "../stepFunction/sfnClient";
import { StartExecutionCommand } from "@aws-sdk/client-sfn";
import { v4 as uuidv4 } from 'uuid';
import { ssmClient } from "../ssm/ssm-client";
import { GetParameterCommand } from "@aws-sdk/client-ssm";

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const parameterInput: GetParameterCommand = new GetParameterCommand({
        Name: 'polygon-key',
        WithDecryption: true
    })
    const polygonKey = await ssmClient.send(parameterInput);

    const ticker: string | null = event.queryStringParameters && event.queryStringParameters['ticker'] ?
                                     event.queryStringParameters['ticker'] : null;
    if(ticker && polygonKey.Parameter?.Value) {
        const uuid = uuidv4();
        const relatedCompanies = await getRelatedCompanies(ticker, polygonKey.Parameter?.Value);
        relatedCompanies.results.push({ticker});
        const stateMachinePayload = relatedCompanies.results.map(r => ({ticker: r.ticker, groupId: uuid}))
        await startStateMachine(stateMachinePayload);
    }

    return {
        statusCode: 200,
        body: ""
    }
}

async function getRelatedCompanies(ticker: string, polygonKeyValue: string): Promise<RelatedCompaniesResponse> {
    let config: AxiosRequestConfig = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://api.polygon.io/v1/related-companies/${ticker}?apiKey=${polygonKeyValue}`,
        headers: { }
      };
      
    const result = await axios.request(config)
    
    return result.data;
}

async function startStateMachine(results: { ticker: string; groupId: string}[]) {
    const params: StartExecutionCommand = new StartExecutionCommand({
        stateMachineArn: process.env['STATE_MACHINE_ARN'],
        input: JSON.stringify(results) // This is the input to the Map state
    });
    await sfnClient.send(params)
}

