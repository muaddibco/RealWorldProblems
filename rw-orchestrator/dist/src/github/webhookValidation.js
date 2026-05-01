"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGitHubSignature = verifyGitHubSignature;
const crypto_1 = require("crypto");
function verifyGitHubSignature(input) {
    if (!input.signature256) {
        throw new Error("Missing x-hub-signature-256 header");
    }
    const expected = `sha256=${(0, crypto_1.createHmac)("sha256", input.secret).update(input.rawBody).digest("hex")}`;
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(input.signature256, "utf8");
    if (expectedBuffer.length !== providedBuffer.length) {
        throw new Error("Invalid webhook signature length");
    }
    if (!(0, crypto_1.timingSafeEqual)(expectedBuffer, providedBuffer)) {
        throw new Error("Invalid webhook signature");
    }
}
