
import * as yargs from "yargs";

import { createLogger } from '../common/logging';
import { FetchOptions, ExchangeSinkOptions, startFetching } from '../fetch/main';
import { metricsOptions, queueOptions, twitterOptions, parseMetricsArgv, parseQueueArgv, parseTwitterArgv } from '../options';

export const command = "fetch <screenName>";

export const describe = "Fetches Tweets of a given screen name";

export const builder: yargs.Builder = Object.assign(<yargs.Builder>{
  "metrics-fetch-job-name": {
    type: "string",
    default: "tweet-fetch",
    group: "Metrics"
  },
  "queue-fetch-exchange-name": {
    type: "string",
    default: "amq.topic",
    group: "Queue"
  },
  "queue-fetch-app-id": {
    type: "string",
    default: "tweet-fetch",
    group: "Queue"
  },
  "queue-fetch-message-type": {
    type: "string",
    default: "tweet",
    group: "Queue"
  },
  "queue-fetch-prefetch": {
    type: "number",
    default: 1,
    group: "Queue"
  },
  "queue-fetch-assert": {
    type: "boolean",
    default: true,
    group: "Queue"
  },
  "queue-fetch-exchange-type": {
    type: "string",
    default: "topic",
    group: "Queue"
  }
}, metricsOptions, queueOptions, twitterOptions);

export const handler = (argv: any) => {
    const options: FetchOptions = {
      metrics: parseMetricsArgv(argv, argv.metricsFetchJobName),
      queue: Object.assign(parseQueueArgv(argv, argv.queueFetchAppId), <ExchangeSinkOptions> {
        appId: argv.queueFetchAppId,
        exchangeName: argv.queueFetchExchangeName,
        messageType: argv.queueFetchMessageType,
        prefetch: argv.queueFetchPrefetch,
        assert: argv.queueFetchAssert,
        type: argv.queueFetchExchangeType
      }),
      twitter: parseTwitterArgv(argv, argv.screenName)
    };

    const logger = createLogger("fetch", options.twitter.screenName);
    logger.info("Fetching tweets");
    startFetching(options).then((count) => {
      logger.info(`Fetched ${count} tweets of @${options.twitter.screenName}`);
      process.exit(0);
    }).catch(error => {
      logger.error(`An error occured while fetching tweets: ${error.message}`, { error });
      process.exit(-1);
    });
}