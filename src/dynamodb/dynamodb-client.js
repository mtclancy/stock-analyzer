"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamodbClient = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
exports.dynamodbClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        convertClassInstanceToMap: true,
        convertEmptyValues: false,
        removeUndefinedValues: true
    }
});
