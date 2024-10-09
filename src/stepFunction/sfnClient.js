"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sfnClient = void 0;
const client_sfn_1 = require("@aws-sdk/client-sfn");
exports.sfnClient = new client_sfn_1.SFNClient({ region: 'us-east-1' });
