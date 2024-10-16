import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { dynamodbClient } from "../dynamodb/dynamodb-client";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import Showdown from "showdown";

interface EmailEvent {
    groupId: string;
    emailTo: string;
}

interface AnalysisDetails {
    ticker: string;
    analysis: string;
}

export async function handler(event: EmailEvent) {
    const queryCommand: QueryCommand = new QueryCommand({
        TableName: process.env['ANALYSIS_TABLE_NAME'],
        IndexName: 'GroupIdIndex', // Replace with the GSI name
        KeyConditionExpression: '#gsiKey = :gsiKeyValue', // Key condition for the GSI
        ExpressionAttributeNames: {
          '#gsiKey': 'groupId', // The key attribute in the GSI (e.g., GSI partition key)
        },
        ExpressionAttributeValues: {
          ':gsiKeyValue': { S: event.groupId }, // Value for the key you're querying by
        },
      })
    const summaryItems = await dynamodbClient.send(queryCommand);
    if(summaryItems.Items && summaryItems.Items?.length > 0) {
        const summaryDetails = summaryItems.Items.map(i => ({ticker: i.ticker.S, analysis: i.analysis.S} as AnalysisDetails));
        const emailHtml = craftEmailHtml(summaryDetails);
  
        return await sendEmail(event.emailTo, emailHtml)
    }
    return null;
}

function craftEmailHtml(summaryDetails: AnalysisDetails[]) {
    const converter = new Showdown.Converter();
    const linebreak = '<br><hr style="border: none; height: 2px; background-color: #000; width: 100%;"><br>'
    const html = summaryDetails.reduce((accumulator, details) => accumulator.concat(`<h2>${details.ticker}</h2>` + converter.makeHtml(details.analysis) + linebreak), '');

    return html
}

async function sendEmail(emailTo: string, emailHtml: string) {
    const client = new SESClient({ region: "us-east-1" });
    const emailCommand: SendEmailCommand = new SendEmailCommand({ // SendEmailRequest
        Source: process.env["EMAIL_FROM"], // required
        Destination: { // Destination
          ToAddresses: [ // AddressList
            emailTo,
          ]
        },
        Message: { // Message
          Subject: { // Content
            Data: "Stock Summary Report", // required
            Charset: "UTF-8",
          },
          Body: { // Body
            Html: {
              Data: emailHtml, // required
              Charset: "UTF-8",
            },
          },
        }
      })
   return await client.send(emailCommand)
      
}