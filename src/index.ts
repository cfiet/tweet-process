import { config } from 'dotenv';
import * as yargs from 'yargs';

config({ silent: true });

yargs
  .env("TWEET_PROC")
  .commandDir("./commands", { recurse: false })
  .help("help")
  .alias("help", "?")
  .argv;
