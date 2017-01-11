import * as yargs from "yargs";

import * as cservice from "cluster-service";
import { createLogger } from '../common/logging';
import {
  metricsOptions,
  queueOptions,
  databaseOptions,
  parseMetricsArgv,
  parseQueueArgv,
  parseDatabaseArgv,
} from '../options';

import { TweetStoreOptions, startStoreService, SourceQueueOptions } from '../store';

export const command = "store"

export const describe = "Starts worker processes that save tweets to database";

export const builder: yargs.Builder = Object.assign(<yargs.Builder>{
  "metrics-store-job-name": {
    type: "string",
    default: "tweet-store",
    group: "Metrics"
  },
  "queue-store-exchange-name": {
    type: "string",
    default: "amq.topic",
    group: "Queue"
  },
  "queue-store-queue-name": {
    type: "string",
    default: "tweet.store",
    group: "Queue"
  },
  "queue-store-routing-pattern": {
    type: "string",
    default: "tweet.*",
    group: "Queue"
  },
  "queue-store-prefetch": {
    type: "number",
    default: 1,
    group: "Queue"
  },
  "queue-store-app-id": {
    type: "string",
    default: "tweet-fetch",
    group: "Queue"
  }
}, metricsOptions, databaseOptions);

export const handler = (argv: any) => {
  const options: TweetStoreOptions = {
    database: parseDatabaseArgv(argv),
    metrics: parseMetricsArgv(argv, argv.metricsStoreJobName),
    queue: Object.assign(parseQueueArgv(argv, argv.queueStireAppId), <SourceQueueOptions>{
      exchangeName: argv.queueStoreExchangeName,
      queue: {
        name: argv.queueStoreQueueName
      },
      routingPattern: argv.queueStoreRoutingPattern,
      prefetch: argv.queueStorePrefetch
    })
  };

  const logger = createLogger("store");
  logger.info("Starting store service");
  startStoreService(options).then(() => {
    logger.info("Store service started");
  }).catch(error => {
    logger.error(`An error occurred while starting store service: ${error.message}`, { error });
    process.exit(-1);
  });
};