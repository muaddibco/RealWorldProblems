import { BatchRetryResponse, BatchRetryResult } from '../types';

export function aggregateBatchRetryResults(results: BatchRetryResult[]): BatchRetryResponse {
  return { ok: true, results };
}