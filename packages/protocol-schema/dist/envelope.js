"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProtocolMessage = createProtocolMessage;
exports.validateProtocolEnvelope = validateProtocolEnvelope;
exports.serializeProtocolMessage = serializeProtocolMessage;
exports.deserializeProtocolMessage = deserializeProtocolMessage;
const node_crypto_1 = require("node:crypto");
const shared_types_1 = require("@clipsync/shared-types");
const errors_js_1 = require("./errors.js");
const VALID_MESSAGE_TYPES = {
    handshake_init: true,
    handshake_ack: true,
    device_announce: true,
    clipboard_sync: true,
    clipboard_ack: true,
    history_request: true,
    history_response: true,
    config_sync: true,
    transfer_offer: true,
    transfer_accept: true,
    transfer_chunk: true,
    transfer_complete: true,
    transfer_cancel: true,
    ping: true,
    pong: true,
    error: true,
};
function createProtocolMessage(options) {
    if (!options.senderDeviceId || options.senderDeviceId.trim().length === 0) {
        throw new errors_js_1.ValidationError('senderDeviceId is required and cannot be empty', 'senderDeviceId');
    }
    if (!VALID_MESSAGE_TYPES[options.type]) {
        throw new errors_js_1.ValidationError(`Unknown message type: "${options.type}"`, 'type');
    }
    return {
        protocolVersion: shared_types_1.PROTOCOL_VERSION,
        messageId: options.messageId ?? (0, node_crypto_1.randomUUID)(),
        senderDeviceId: options.senderDeviceId,
        targetDeviceId: options.targetDeviceId ?? null,
        timestamp: options.timestamp ?? Date.now(),
        type: options.type,
        payload: options.payload,
        ...(options.signature ? { signature: options.signature } : {}),
    };
}
function validateProtocolEnvelope(message) {
    if (!message || typeof message !== 'object') {
        throw new errors_js_1.ValidationError('Message must be a non-null object');
    }
    const candidate = message;
    if (candidate.protocolVersion !== shared_types_1.PROTOCOL_VERSION) {
        throw new errors_js_1.VersionMismatchError(shared_types_1.PROTOCOL_VERSION, typeof candidate.protocolVersion === 'string' ? candidate.protocolVersion : 'unknown');
    }
    if (typeof candidate.messageId !== 'string' || candidate.messageId.trim().length === 0) {
        throw new errors_js_1.ValidationError('messageId must be a non-empty string', 'messageId');
    }
    if (typeof candidate.senderDeviceId !== 'string' || candidate.senderDeviceId.trim().length === 0) {
        throw new errors_js_1.ValidationError('senderDeviceId must be a non-empty string', 'senderDeviceId');
    }
    if (candidate.targetDeviceId !== null && typeof candidate.targetDeviceId !== 'string') {
        throw new errors_js_1.ValidationError('targetDeviceId must be null or string', 'targetDeviceId');
    }
    if (typeof candidate.timestamp !== 'number' || Number.isNaN(candidate.timestamp) || candidate.timestamp <= 0) {
        throw new errors_js_1.ValidationError('timestamp must be a positive integer', 'timestamp');
    }
    if (!VALID_MESSAGE_TYPES[candidate.type]) {
        throw new errors_js_1.ValidationError(`Invalid message type: "${candidate.type}"`, 'type');
    }
    if (candidate.payload === undefined) {
        throw new errors_js_1.ValidationError('payload cannot be undefined', 'payload');
    }
    return true;
}
function serializeProtocolMessage(message) {
    validateProtocolEnvelope(message);
    return JSON.stringify(message);
}
function deserializeProtocolMessage(rawJson) {
    let parsed;
    try {
        parsed = JSON.parse(rawJson);
    }
    catch (err) {
        throw new errors_js_1.ValidationError(`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`);
    }
    validateProtocolEnvelope(parsed);
    return parsed;
}
//# sourceMappingURL=envelope.js.map