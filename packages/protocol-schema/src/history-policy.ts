import { ClipboardItem, HistoryPolicy } from '@clipsync/shared-types';
import { ValidationError } from './errors.js';

export function validateHistoryPolicy(policy: HistoryPolicy): void {
  if (policy.retentionDays === 0) {
    throw new ValidationError(
      'retentionDays cannot be 0. Use unlimitedRetention: true with retentionDays: null to indicate indefinite retention.',
      'retentionDays'
    );
  }

  if (policy.unlimitedRetention && policy.retentionDays !== null && policy.retentionDays !== undefined) {
    throw new ValidationError(
      'When unlimitedRetention is true, retentionDays must be null.',
      'retentionDays'
    );
  }

  if (!policy.unlimitedRetention && (!policy.retentionDays || policy.retentionDays <= 0)) {
    throw new ValidationError(
      'retentionDays must be a positive integer when unlimitedRetention is false.',
      'retentionDays'
    );
  }

  if (policy.maxItems <= 0) {
    throw new ValidationError('maxItems must be a positive number greater than 0', 'maxItems');
  }

  if (policy.maxStorageBytes <= 0) {
    throw new ValidationError('maxStorageBytes must be greater than 0', 'maxStorageBytes');
  }
}

export interface PruneResult {
  itemsToKeep: ClipboardItem[];
  itemsToPrune: ClipboardItem[];
  reasons: {
    expiredByAge: number;
    exceededMaxItems: number;
    exceededStorageBytes: number;
  };
  totalRemainingBytes: number;
}

export interface PruneOptions {
  currentTimeMs?: number;
  exemptPinnedItems?: boolean;
}

export function evaluateHistoryPruning(
  items: ClipboardItem[],
  policy: HistoryPolicy,
  options: PruneOptions = {}
): PruneResult {
  validateHistoryPolicy(policy);

  if (!policy.cleanupEnabled) {
    const totalBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
    return {
      itemsToKeep: [...items],
      itemsToPrune: [],
      reasons: { expiredByAge: 0, exceededMaxItems: 0, exceededStorageBytes: 0 },
      totalRemainingBytes: totalBytes,
    };
  }

  const now = options.currentTimeMs ?? Date.now();
  const exemptPinned = options.exemptPinnedItems ?? true;

  const expiredByAgeList: ClipboardItem[] = [];
  const candidateItems: ClipboardItem[] = [];

  // 1. Evaluate age-based retention
  for (const item of items) {
    if (exemptPinned && item.isPinned) {
      candidateItems.push(item);
      continue;
    }

    if (!policy.unlimitedRetention && policy.retentionDays !== null) {
      const ageMs = now - item.createdAt;
      const maxAgeMs = policy.retentionDays * 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        expiredByAgeList.push(item);
        continue;
      }
    }

    candidateItems.push(item);
  }

  // Sort candidate items: pinned first, then newest first
  candidateItems.sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    return b.createdAt - a.createdAt;
  });

  // 2. Evaluate maxItems limit
  const itemsKeptByCount: ClipboardItem[] = [];
  const exceededCountList: ClipboardItem[] = [];

  for (let i = 0; i < candidateItems.length; i++) {
    const item = candidateItems[i];
    if (itemsKeptByCount.length < policy.maxItems || (exemptPinned && item.isPinned)) {
      itemsKeptByCount.push(item);
    } else {
      exceededCountList.push(item);
    }
  }

  // 3. Evaluate maxStorageBytes limit (even with unlimited retention, storage limits apply)
  const finalKept: ClipboardItem[] = [];
  const exceededStorageList: ClipboardItem[] = [];
  let currentBytes = 0;

  for (const item of itemsKeptByCount) {
    if (currentBytes + item.sizeBytes <= policy.maxStorageBytes || (exemptPinned && item.isPinned)) {
      finalKept.push(item);
      currentBytes += item.sizeBytes;
    } else {
      exceededStorageList.push(item);
    }
  }

  const pruned = [...expiredByAgeList, ...exceededCountList, ...exceededStorageList];

  return {
    itemsToKeep: finalKept,
    itemsToPrune: pruned,
    reasons: {
      expiredByAge: expiredByAgeList.length,
      exceededMaxItems: exceededCountList.length,
      exceededStorageBytes: exceededStorageList.length,
    },
    totalRemainingBytes: currentBytes,
  };
}
