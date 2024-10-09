import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamo from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import { DefinitionBody, IChainable, Map, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class StockSummaryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tableOptions: dynamo.TableProps = {
      tableName: 'stock-analysis',
      partitionKey: {
        type: dynamo.AttributeType.STRING,
        name: 'id'
      },
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST
    };

    const stockSummaryTable = new dynamo.Table(this, 'stock-summary-table', tableOptions);

    stockSummaryTable.addGlobalSecondaryIndex({
      indexName: 'GroupIdIndex',
      partitionKey: { name: 'groupId', type: dynamo.AttributeType.STRING},
      projectionType: dynamo.ProjectionType.ALL
    })
    
    const polygonIAM = new PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        'arn:aws:ssm:us-east-1:533267426111:parameter/polygon-key'
      ]
    })

    const analysisKeysIAM = new PolicyStatement({
      actions: ['ssm:GetParameters'],
      resources: [
        'arn:aws:ssm:us-east-1:533267426111:parameter/alpha-key',
        'arn:aws:ssm:us-east-1:533267426111:parameter/open-ai-key'
      ]
    })


    const stockAnalysisLambdaProps: lambda.NodejsFunctionProps = {
      functionName: 'stockAnalysisHandler',
      entry: '../src/sentiment-handler/index.ts',
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      architecture: Architecture.ARM_64,
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      environment: {
        ANALYSIS_TABLE_NAME: stockSummaryTable.tableName
      }
    }
    
    const stockAnalysisLambda = new lambda.NodejsFunction(this, 'stock-analysis-lambda', stockAnalysisLambdaProps);
    
    const analysisMapStep = new Map(this, 'analysis-map', {
      maxConcurrency: 2,
      itemsPath: '$'
    })
    const chainableStep: IChainable = new LambdaInvoke(this, 'analysis-map-invoke', { lambdaFunction: stockAnalysisLambda })
    analysisMapStep.itemProcessor(chainableStep)
    
    const analysisStepFunction = new StateMachine(this, 'analysis-state-machine', {
      definitionBody: DefinitionBody.fromChainable(analysisMapStep)
    })
    
    const relatedCompaniesLambdaProps: lambda.NodejsFunctionProps = {
      functionName: 'relatedCompaniesHandler',
      entry: '../src/related-companies/index.ts',
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      architecture: Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      environment: {
        STATE_MACHINE_ARN: analysisStepFunction.stateMachineArn
      }
    }

    const relatedCompaniesLambda = new lambda.NodejsFunction(this, 'related-companies-lambda', relatedCompaniesLambdaProps);
    
    const api = new apiGateway.RestApi(this, 'stock-ticker-api', {
      restApiName: 'StockAnalysis',
      description: 'API to trigger Step Function via Lambda',
      endpointConfiguration: {
        types: [apiGateway.EndpointType.REGIONAL]
      }
    });

    const lambdaIntegration = new apiGateway.LambdaIntegration(relatedCompaniesLambda);

    const analysisRoot = api.root.addResource("analysis")
    
    analysisRoot.addMethod("POST", lambdaIntegration)
    analysisStepFunction.grantStartExecution(relatedCompaniesLambda);
    stockSummaryTable.grantReadWriteData(stockAnalysisLambda);
    relatedCompaniesLambda.addToRolePolicy(polygonIAM);
    stockAnalysisLambda.addToRolePolicy(analysisKeysIAM);

  }
}
