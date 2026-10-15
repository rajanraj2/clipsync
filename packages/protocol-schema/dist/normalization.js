"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSha256 = computeSha256;
exports.normalizeContent = normalizeContent;
const node_crypto_1 = require("node:crypto");
const errors_js_1 = require("./errors.js");
function computeSha256(content) {
    return (0, node_crypto_1.createHash)('sha256').update(content, 'utf8').digest('hex');
}
function normalizeContent(rawContent, contentType) {
    if (typeof rawContent !== 'string') {
        throw new errors_js_1.ValidationError('Content must be a string', 'content');
    }
    let normalized = rawContent;
    if (contentType === 'text') {
        // Normalize newlines to standard LF for cross-platform consistency
        normalized = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    else if (contentType === 'url') {
        const trimmed = rawContent.trim();
        try {
            const parsed = new URL(trimmed);
            if (!['http:', 'https:', 'ftp:'].includes(parsed.protocol)) {
                throw new Error('Unsupported URL protocol');
            }
            normalized = parsed.toString();
        }
        catch {
            throw new errors_js_1.ValidationError(`Invalid URL format: "${trimmed}"`, 'content');
        }
    }
    const sizeBytes = Buffer.byteLength(normalized, 'utf8');
    const hash = computeSha256(normalized);
    return {
        normalized,
        hash,
        sizeBytes,
        contentType,
    };
}
//# sourceMappingURL=normalization.js.map