import { BaseProtocolMessage, MessageType, ProtocolMessage } from '@clipsync/shared-types';
export interface CreateMessageOptions<T> {
    type: MessageType;
    senderDeviceId: string;
    targetDeviceId?: string | null;
    payload: T;
    messageId?: string;
    timestamp?: number;
    signature?: string;
}
export declare function createProtocolMessage<T>(options: CreateMessageOptions<T>): BaseProtocolMessage<T>;
export declare function validateProtocolEnvelope(message: unknown): message is ProtocolMessage;
export declare function serializeProtocolMessage(message: BaseProtocolMessage<unknown>): string;
export declare function deserializeProtocolMessage(rawJson: string): ProtocolMessage;
//# sourceMappingURL=envelope.d.ts.map