import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib"
import * as dynamo from "aws-cdk-lib/aws-dynamodb";

export class BaseStack extends cdk.Stack {
   
    userTable: cdk.aws_dynamodb.Table;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const userTableProps: dynamo.TableProps = {
        tableName: 'user-table',
        partitionKey: {
            type: dynamo.AttributeType.STRING,
            name: 'id'
        },
        billingMode: dynamo.BillingMode.PAY_PER_REQUEST
        };

        this.userTable = new dynamo.Table(this, 'user-table', userTableProps);
    }
}