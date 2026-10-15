import { ClipboardItem, HistoryPolicy } from '@clipsync/shared-types';
export declare function validateHistoryPolicy(policy: HistoryPolicy): void;
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
export declare function evaluateHistoryPruning(items: ClipboardItem[], policy: HistoryPolicy, options?: PruneOptions): PruneResult;
//# sourceMappingURL=history-policy.d.ts.map