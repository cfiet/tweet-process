import { connect } from 'amqplib';
import Twitter = require('twitter');
import { TwitterClient } from 'twitter/interfaces';
import { Observable, Subscriber } from 'rxjs';

import { createLogger } from '../common/logging';
import { Counter, Gauge, Histogram } from '../common/metrics';
import { Tweet } from '../common/data';

export interface TwitterOptions {
  consumerKey: string;
  consumerSecret: string;
  accessTokenKey: string;
  accessTokenSecret: string;
  screenName: string;
  maxBatchSize: number;
}

let apiRequestsCounter = new Counter(
  "twitterapi_request_count",
  "Number of requests made to Twitter API",
  ["consumer_key", "screen_name"]
);

let apiRequestsErrorCounter = new Counter(
  "twitterapi_request_error_count",
  "Number of failed requests to Twitter API",
  ["consumer_key", "screen_name"]
);

let apiRequestsSuccessCounter = new Counter(
  "twitterapi_request_success_count",
  "Number of successful requests to Twitter API",
  ["consumer_key", "screen_name"]
);

let tweetFetchedCount = new Counter(
  "tweetprocess_tweets_fetched",
  "Number of tweets fetched",
  ["consumer_key", "screen_name"]
);

let tweetFetchingTimings = new Gauge(
  "tweetprocess_tweets_fetching",
  "Duration of a complete tweets fetching",
  ["consumer_key", "screen_name"]
);

export function fetchTweets(options: TwitterOptions): Observable<Tweet> {
  const client = new Twitter({
    consumer_key: options.consumerKey,
    consumer_secret: options.consumerSecret,
    access_token_key: options.accessTokenKey,
    access_token_secret: options.accessTokenSecret
  });

  return new Observable<any>((sub: Subscriber<any>) => {
    const { consumerKey, screenName, maxBatchSize } = options;
    const logger = createLogger("fetch", 'twitter', screenName);
    let lastId: number = undefined;

    const fetchTimer = tweetFetchingTimings.labels(consumerKey, screenName);
    function fetchBatch() {
      const params = {
        screen_name: screenName,
        trim_user: true,
        exclude_replies: true,
        include_rts: false,
        count: maxBatchSize,
        max_id: lastId
      };

      logger.info('Fetching tweets through Twitter API', params);
      apiRequestsCounter.labels(consumerKey, screenName).inc();
      client.get<any[]>('statuses/user_timeline', params, (error, result) => {
        if(error) {
          apiRequestsErrorCounter.labels(consumerKey, screenName).inc();
          logger.error(`An error occured while calling Twitter API: ${error}`, { error })
          sub.error(error);
          return;
        }

        apiRequestsSuccessCounter.labels(consumerKey, screenName).inc();

        if (!result || !result.length) {
          logger.info('No tweets have been fetched, closing producer');
          sub.complete();
          return;
        }

        const allIds = result.map(t => t.id);
        const newLastId = Math.min.apply(Math, allIds);
        logger.info(`Fetched ${result.length} tweets`, {
          lastId, newLastId
        });

        if (newLastId === lastId) {
          logger.info('No more tweets to fetch, closing producer');
          sub.complete();
          return;
        }
        
        result.filter(t => 
          t.id !== lastId
        ).forEach(t => {
          tweetFetchedCount.labels(consumerKey, screenName).inc();
          sub.next(t)
        });
        
        lastId = newLastId;
        fetchBatch();
      });
    }

    fetchTimer.setToCurrentTime();
    let end = fetchTimer.startTimer();
    sub.add(() => end());

    fetchBatch();
    logger.info('Started fetching tweets');
  });
}

export default fetchTweets;