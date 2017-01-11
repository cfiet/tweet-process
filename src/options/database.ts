import * as yargs from 'yargs';

export interface DatabaseOptions {
  connectionString: string;
}

export const databaseOptions: yargs.Builder = {
  "database-connection-string": {
    type: "string",
    require: true,
    group: "Database"
  }
};

export function parseDatabaseArgv(argv: any): DatabaseOptions {
  return {
    connectionString: argv.databaseConnectionString
  };
}