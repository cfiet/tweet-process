import { createLogger } from '../common/logging';
import { FetchOptions, startFetching, DefaultExchangeSinkOptions, DefaultMetricsOptions } from './index';

const logger = createLogger('fetch', 'cli');

const options: FetchOptions = {
  metrics: new DefaultMetricsOptions(
    process.env.TWEET_PROCESS_METRICS_PUSHGATEWAY_URL,
    process.env.TWEET_PROCESS_METRICS_JOB_NAME
  ),
  queue: new DefaultExchangeSinkOptions(
    process.env.TWEET_PROCESS_QUEUE_URL,
    process.env.TWEET_PROCESS_QUEUE_NAME,
    process.env.TWEET_PROCESS_QUEUE_MESSAGE_TYPE,
    process.env.TWEET_PROCESS_QUEUE_APP_ID
  ),
  twitter: {
    consumerKey: process.env.TWEET_PROCESS_API_CONSUMER_KEY,
    consumerSecret: process.env.TWEET_PROCESS_API_CONSUMER_SECRET,
    accessTokenKey: process.env.TWEET_PROCESS_API_ACCESS_TOKEN_KEY,
    accessTokenSecret: process.env.TWEET_PROCESS_API_ACCESS_TOKEN_SECRET,
    screenName: process.env.TWEET_PROCESS_FETCH_SCREEN_NAME,
    maxBatchSize: process.env.TWEET_PROCESS_FETCH_BATCH_MAX_SIZE
  }
}

logger.info(`Fetching tweets of @${options.twitter.screenName}`);
startFetching(options).then((count) => {
  logger.info(`Fetched ${count} tweets of @${options.twitter.screenName}`);
  process.exit(0);
}).catch(error => {
  logger.error(`An error occured while fetching tweets: ${error.message}`, { error });
  process.exit(-1);
});