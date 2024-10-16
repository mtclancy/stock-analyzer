import { Table } from "aws-cdk-lib/aws-dynamodb";

export interface SharedResources {
    userTable: Table
}
