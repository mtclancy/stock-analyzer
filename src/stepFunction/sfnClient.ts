import { SFNClient } from "@aws-sdk/client-sfn";

export const sfnClient = new SFNClient({region: 'us-east-1'});