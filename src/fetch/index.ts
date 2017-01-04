import { config } from 'dotenv';

import { Tweet } from '../common/data';
import { MetricsOptions, DefaultMetricsOptions, MetricsClient } from '../common/metrics';
import { ExchangeSink, ExchangeSinkOptions, DefaultExchangeSinkOptions } from './queue';
import { TwitterOptions, fetchTweets } from './twitter';

export { DefaultMetricsOptions } from '../common/metrics';
export { DefaultExchangeSinkOptions } from './queue';

config({ silent: true, path: process.env.TWEET_PROCESS_DOTENV_FILE });

export interface FetchOptions {
  metrics: MetricsOptions,
  queue: ExchangeSinkOptions,
  twitter: TwitterOptions
}

export async function startFetching(options: FetchOptions) {
  MetricsClient.start(options.metrics);

  let exchange = await ExchangeSink.create<Tweet>(options.queue);

  return fetchTweets(options.twitter)
    .do((tweet: Tweet) => {
      exchange.publish(
        tweet,
        `tweet.${options.twitter.screenName}`,
        tweet.id.toString(),
        tweet.id.toString()
      );
    })
    .count()
    .finally(() => {
      exchange.close();
    })
    .toPromise().then(async (count) => {
      await MetricsClient.stop();
      return count;
    });
}
