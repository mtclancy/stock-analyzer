import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios, { AxiosRequestConfig } from "axios";
import { RelatedCompaniesResponse } from "./types/polygon.types";
import { sfnClient } from "../stepFunction/sfnClient";
import { StartExecutionCommand } from "@aws-sdk/client-sfn";
import { v4 as uuidv4 } from 'uuid';
import { ssmClient } from "../ssm/ssm-client";
import { GetParameterCommand } from "@aws-sdk/client-ssm";

interface MapFunctionPayload {
    ticker: string;
    groupId: string;
    email: string;
}

interface CompanyRequest {
    emailTo: string,
    ticker: string,
    compare: boolean
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const parameterInput: GetParameterCommand = new GetParameterCommand({
        Name: 'polygon-key',
        WithDecryption: true
    })
    const polygonKey = await ssmClient.send(parameterInput);
    const eventBody: CompanyRequest = JSON.parse(event.body as string);
    const uuid = uuidv4();
    const originalCompany = {ticker: eventBody.ticker, groupId: uuid, email: eventBody.emailTo};

    let relatedCompanies: MapFunctionPayload[] = [];
    
    if(eventBody.ticker && polygonKey.Parameter?.Value && eventBody.compare) {
        const getCompaniesResult = await getRelatedCompanies(eventBody.ticker, polygonKey.Parameter?.Value);
        relatedCompanies = getCompaniesResult.results.map(r => ({ticker: r.ticker, groupId: uuid, email: eventBody.emailTo }));
    }

    const stateMachinePayload = [originalCompany, ...relatedCompanies];
    await startStateMachine(stateMachinePayload, eventBody.emailTo);
    
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


async function startStateMachine(results: MapFunctionPayload[], emailTo: string) {
    const input = {
        groupId: results[0].groupId,
        itemsPath: results,
        emailTo
    }
    const params: StartExecutionCommand = new StartExecutionCommand({
        stateMachineArn: process.env['STATE_MACHINE_ARN'],
        input: JSON.stringify(input) // This is the input to the Map state
    });
    await sfnClient.send(params)
}

