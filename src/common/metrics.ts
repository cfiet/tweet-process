import * as os from "os";
import { format, parse, Url } from "url";
import { Counter, Gauge, Histogram, Pushgateway, Summary, defaultMetrics, register } from "prom-client";
export { Counter, Gauge, Histogram, Summary, register } from "prom-client";

import { Logger, createLogger } from "./logging";

export type Labels = { [ key: string ]: string };

const logger = createLogger("tweet-process", "lib", "metrics");

export interface MetricsOptions {
  pushgatewayUrl: string;
  pushInterval: number;
  defaultBlacklist?: string[];
  interval?: number;
  jobName: string;
}

export class DefaultMetricsOptions implements MetricsOptions {
  public interval?: number;
  public defaultBlacklist?: string[];

  constructor(
    public pushgatewayUrl: string,
    public jobName: string,
    public pushInterval: number = 1000
  ) { }
}

export class MetricsClient {
  private static _default: MetricsClient;

  private _interval: NodeJS.Timer;
  private _pushgateway: Pushgateway;
  private _params: Pushgateway.Parameters;
  private _logger: Logger;

  get running (): boolean {
    return !!this._interval;
  }

  private constructor(
    private _url: Url,
    private _pushInterval: number,
    jobName: string,
    groupings: Labels
  ) {
    this._params = { jobName, groupings };
    this._logger = createLogger('common', 'metrics', 'client', `${_url.host}:${_url.port}`);
    this._pushgateway = new Pushgateway(_url.href);
    
    process.once("uncaughtException", () => {
      this.pause();
      this.dispose();
    });

    this._pushStats();
    this.resume();
  }

  public resume() {
    this._interval = setInterval(() => {
      this._pushStats()
    }, this._pushInterval);
  }

  public pause() {
    clearInterval(this._interval);
    this._interval = null;
  }

  private _pushStats(): Promise<void> {
    return new Promise<void>((resolve,reject) => {
      this._logger.info(`Pushing stats to Pushgateway`, this._params);
      this._pushgateway.pushAdd(this._params, (error: Error) => {
        if (error) {
          this._logger.error(`An error occured while pushing stats to Pushgateway: ${error.message}`, { error, params: this._params })
          return reject(error);
        }
        this._logger.info(`Successfully pushed stats to Pushgateway`);
        return resolve();
      });
    });
  }

  public dispose(): Promise<void> {
    this.pause();
    this._logger.info(`Pushing final stats`);
    return this._pushStats().then(() => {
      return new Promise<void>((resolve) => {
        const waitTime = this._pushInterval * 1.6;
        this._logger.info(`Waiting ${waitTime}ms, to allow final Prometheus scrape`);
        setTimeout(() => resolve(), waitTime);
      })
    })
    .then(() => {
      return new Promise<void>((resolve, reject) => {
        this._logger.info(`Disposing Pushgateway stats`);
        this._pushgateway.delete(this._params, (error: Error) => {
          if (error) {
            this._logger.error(`An error occured while disposing Pushgateway stats: ${error.message}`, { error, params: this._params });
            return reject(error);
          }
          this._logger.info('Successfully disposed Pushgateway stats', this._params);
          return resolve();
        });
      });
    });
  }

  public static create(
    options: MetricsOptions,
    labels: Labels,
  ): MetricsClient {
    defaultMetrics(options.defaultBlacklist, options.interval);
    logger.info("Registered default metrics", {
      blacklist: options.defaultBlacklist,
      interval: options.interval
    });

    const pushgatewayUrl = parse(options.pushgatewayUrl);
    return new MetricsClient(
      pushgatewayUrl,
      options.pushInterval,
      options.jobName,
      labels
    );
  }

  public static start(options: MetricsOptions): void {
    function getDefaultLabels() {
      return {
        hostname: os.hostname(),
        username: os.userInfo().username
      };
    }

    if (MetricsClient._default) {
      MetricsClient._default.dispose();
    }

    MetricsClient._default = MetricsClient.create(options, {
      hostname: os.hostname(),
      username: os.userInfo().username.toString()
    });
  }

  public static stop(): Promise<void> {
    if (!MetricsClient._default) {
      return Promise.resolve();
    }

    return MetricsClient._default.dispose();
  }
}

export default MetricsClient;