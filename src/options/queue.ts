import * as yargs from 'yargs';

import { QueueOptions } from '../common/queue/options';

export const queueOptions: yargs.Builder = {
  "queue-url": {
    type: "string",
    require: true,
    group: "Queue"
  }
}

export function parseQueueArgv(argv: any, appId: string): QueueOptions {
  return {
    queueUrl: argv.queueUrl,
    appId
  };
}