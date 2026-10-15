"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateHistoryPolicy = validateHistoryPolicy;
exports.evaluateHistoryPruning = evaluateHistoryPruning;
const errors_js_1 = require("./errors.js");
function validateHistoryPolicy(policy) {
    if (policy.retentionDays === 0) {
        throw new errors_js_1.ValidationError('retentionDays cannot be 0. Use unlimitedRetention: true with retentionDays: null to indicate indefinite retention.', 'retentionDays');
    }
    if (policy.unlimitedRetention && policy.retentionDays !== null && policy.retentionDays !== undefined) {
        throw new errors_js_1.ValidationError('When unlimitedRetention is true, retentionDays must be null.', 'retentionDays');
    }
    if (!policy.unlimitedRetention && (!policy.retentionDays || policy.retentionDays <= 0)) {
        throw new errors_js_1.ValidationError('retentionDays must be a positive integer when unlimitedRetention is false.', 'retentionDays');
    }
    if (policy.maxItems <= 0) {
        throw new errors_js_1.ValidationError('maxItems must be a positive number greater than 0', 'maxItems');
    }
    if (policy.maxStorageBytes <= 0) {
        throw new errors_js_1.ValidationError('maxStorageBytes must be greater than 0', 'maxStorageBytes');
    }
}
function evaluateHistoryPruning(items, policy, options = {}) {
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
    const expiredByAgeList = [];
    const candidateItems = [];
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
    const itemsKeptByCount = [];
    const exceededCountList = [];
    for (let i = 0; i < candidateItems.length; i++) {
        const item = candidateItems[i];
        if (itemsKeptByCount.length < policy.maxItems || (exemptPinned && item.isPinned)) {
            itemsKeptByCount.push(item);
        }
        else {
            exceededCountList.push(item);
        }
    }
    // 3. Evaluate maxStorageBytes limit (even with unlimited retention, storage limits apply)
    const finalKept = [];
    const exceededStorageList = [];
    let currentBytes = 0;
    for (const item of itemsKeptByCount) {
        if (currentBytes + item.sizeBytes <= policy.maxStorageBytes || (exemptPinned && item.isPinned)) {
            finalKept.push(item);
            currentBytes += item.sizeBytes;
        }
        else {
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
//# sourceMappingURL=history-policy.js.map