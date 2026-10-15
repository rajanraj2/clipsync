import type { ContentType } from '@clipsync/shared-types';
export interface NormalizedContentResult {
    normalized: string;
    hash: string;
    sizeBytes: number;
    contentType: ContentType;
}
export declare function computeSha256(content: string): string;
export declare function normalizeContent(rawContent: string, contentType: ContentType): NormalizedContentResult;
//# sourceMappingURL=normalization.d.ts.map