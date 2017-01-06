import * as yargs from 'yargs';

import { MetricsOptions } from "../common/metrics";

export const metricsOptions: yargs.Builder = {
  "metrics-pushgateway-url": {
    type: "string",
    require: true,
    group: "Metrics"
  },
  "metrics-job-name": {
    type: "string",
    require: true,
    group: "Metrics"
  },
  "metrics-push-interval": {
    type: "number",
    require: true,
    default: 1000,
    group: "Metrics"
  },
  "metrics-blacklist": {
    type: "array",
    require: false,
    default: [],
    group: "Metrics"
  },
  "metrics-interval": {
    type: "number",
    require: false,
    group: "Metrics"
  },
};

export function parseMetricsArgv(argv: any): MetricsOptions {
  return {
    pushgatewayUrl: argv.metricsPushgatewayUrl,
    jobName: argv.metricsJobName,
    pushInterval: argv.metricsPushInterval,
    defaultBlacklist: argv.metricsBlacklist,
    interval: argv.metricsInterval
  };
}