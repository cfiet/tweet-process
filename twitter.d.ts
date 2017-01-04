declare module 'twitter/interfaces' {
  interface TwitterApiSettings {
    consumer_key: string;
	  consumer_secret: string;
	  access_token_key: string;
	  access_token_secret: string;
  }

  interface TwitterClient {
    get<TResult>(
      endpoint: string,
      params: any,
      callback: (error: Error, result: TResult) => void
    ): void;
  }

  interface TwitterClientFactory extends TwitterClient {
    new (settings?: TwitterApiSettings): TwitterClient
  }
}

declare module 'twitter' {
  import { TwitterClientFactory } from 'twitter/interfaces';

  const Twitter: TwitterClientFactory;
  export = Twitter;
}