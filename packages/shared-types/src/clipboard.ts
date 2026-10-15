export type ContentType = 'text' | 'url' | 'image' | 'file';

export interface ClipboardItem {
  id: string;
  sourceDeviceId: string;
  contentType: ContentType;
  /**
   * Raw text or URL content, or blob storage identifier/hash for binary files and images
   */
  content: string;
  preview?: string;
  sizeBytes: number;
  /** SHA-256 hash of payload content for deduplication and integrity check */
  hash: string;
  isPinned: boolean;
  isFavourite: boolean;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ClipboardPayload {
  item: ClipboardItem;
  /** Sequence number or logical clock timestamp for conflict ordering */
  sequenceNumber?: number;
}
