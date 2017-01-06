import * as yargs from 'yargs';

import { QueueOptions } from '../common/queue/options';

export const queueOptions: yargs.Builder = {
  "queue-url": {
    type: "string",
    require: true,
    group: "Queue"
  },
  "queue-app-id": {
    type: "string",
    require: false,
    default: "tweet-process",
    group: "Queue"
  }
}

export function parseQueueArgv(argv: any): QueueOptions {
  return {
    queueUrl: argv.queueUrl,
    appId: argv.queueAppId
  };
}