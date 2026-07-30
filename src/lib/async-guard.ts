type RetryOptions = {
  retries?: number;
  delayMs?: number;
  backoffFactor?: number;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withTimeout<T>(
  promiseFactory: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = "Operation timed out",
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promiseFactory(), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function retryAsync<T>(
  action: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 1;
  const baseDelay = options.delayMs ?? 250;
  const backoffFactor = options.backoffFactor ?? 2;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const delay = Math.round(baseDelay * Math.pow(backoffFactor, attempt));
      await sleep(delay);
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Retry failed");
}
