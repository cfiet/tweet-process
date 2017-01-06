import * as when from 'when';

export function unwrapPromise<T>(promise: when.Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    promise.then(resolve).catch(reject);
  });
}
