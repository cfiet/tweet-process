import * as yargs from 'yargs';

import { MetricsOptions } from "../common/metrics";

export const metricsOptions: yargs.Builder = {
  "metrics-pushgateway-url": {
    type: "string",
    require: true,
    group: "Metrics"
  },
  "metrics-push-interval": {
    type: "number",
    default: 1000,
    group: "Metrics"
  },
  "metrics-blacklist": {
    type: "array",
    default: [],
    group: "Metrics"
  },
  "metrics-interval": {
    type: "number",
    group: "Metrics"
  },
};

export function parseMetricsArgv(argv: any, jobName: string): MetricsOptions {
  return {
    jobName,
    pushgatewayUrl: argv.metricsPushgatewayUrl,
    pushInterval: argv.metricsPushInterval,
    defaultBlacklist: argv.metricsBlacklist,
    interval: argv.metricsInterval
  };
}