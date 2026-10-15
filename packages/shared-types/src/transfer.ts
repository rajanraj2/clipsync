export type TransferStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface TransferItem {
  id: string;
  sourceDeviceId: string;
  targetDeviceIds: string[];
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  status: TransferStatus;
  bytesTransferred: number;
  /** Floating progress between 0.0 and 1.0 */
  progress: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export interface TransferChunk {
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  data: string; // Base64 encoded or binary payload representation
  checksum: string;
}
