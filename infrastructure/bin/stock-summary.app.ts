#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StockSummaryStack } from '../lib/stock-summary.stack';
import { BaseStack } from '../lib/base.stack';

const app = new cdk.App();
const baseStack = new BaseStack(app, 'BaseStack')
const stockAnalysisStack = new StockSummaryStack(app, 'AdventureBackendStack', {}, { userTable: baseStack.userTable });

stockAnalysisStack.addDependency(baseStack);