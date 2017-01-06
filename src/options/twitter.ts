import * as yargs from 'yargs';

import { TwitterOptions } from '../fetch/twitter';

export const twitterOptions: yargs.Builder = {
  "twitter-consumer-key": {
    type: "string",
    required: true,
    group: "Twitter API"
  },
  "twitter-consumer-secret": {
    type: "string",
    required: true,
    group: "Twitter API"
  },
  "twitter-access-token-key": {
    type: "string",
    required: true,
    group: "Twitter API"
  },
  "twitter-access-token-secret": {
    type: "string",
    required: true,
    group: "Twitter API"
  },
  "twitter-max-batch-size": {
    type: "number",
    required: true,
    default: 200,
    group: "Twitter API"
  }
};

export function parseTwitterArgv(argv: any, screenName: string): TwitterOptions {
  return {
    consumerKey: argv.twitterConsumerKey,
    consumerSecret: argv.twitterConsumerSecret,
    accessTokenKey: argv.twitterAccessTokenKey,
    accessTokenSecret: argv.twitterAccessTokenSecret,
    maxBatchSize: argv.maxBatchSize,
    screenName
  };
}
