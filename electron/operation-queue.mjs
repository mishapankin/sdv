export function createOperationQueue() {
  let tail = Promise.resolve();

  return function enqueue(operation) {
    const result = tail.then(operation, operation);
    tail = result.catch(() => {});
    return result;
  };
}
