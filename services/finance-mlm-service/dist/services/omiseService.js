"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOmisePublicKey = getOmisePublicKey;
exports.isOmiseConfigured = isOmiseConfigured;
exports.createOmiseCharge = createOmiseCharge;
exports.retrieveOmiseCharge = retrieveOmiseCharge;
exports.createOmiseRecipient = createOmiseRecipient;
exports.createOmiseTransfer = createOmiseTransfer;
exports.downloadOmiseDocumentAsDataUri = downloadOmiseDocumentAsDataUri;
const OMISE_API_BASE_URL = process.env.OMISE_API_BASE_URL || "https://api.omise.co";
function getOmisePublicKey() {
    return process.env.OMISE_PUBLIC_KEY || "";
}
function isOmiseConfigured() {
    return Boolean(process.env.OMISE_PRIVATE_KEY && process.env.OMISE_PUBLIC_KEY);
}
async function createOmiseCharge(input) {
    const params = new URLSearchParams();
    params.set("amount", String(input.amount));
    params.set("currency", input.currency.toLowerCase());
    params.set("description", input.description);
    params.set("return_uri", input.returnUri);
    params.set("metadata[paymentIntentId]", input.paymentIntentId);
    params.set("metadata[enrollmentId]", input.enrollmentId);
    params.set("metadata[studentUserId]", input.studentUserId);
    params.set("metadata[method]", input.method);
    if (input.ip) {
        params.set("ip", input.ip);
    }
    if (input.method === "card") {
        if (!input.cardToken) {
            throw new Error("OMISE_CARD_TOKEN_REQUIRED");
        }
        params.set("card", input.cardToken);
    }
    else {
        params.set("source[type]", "promptpay");
        params.set("source[amount]", String(input.amount));
        params.set("source[currency]", input.currency.toLowerCase());
        params.set("source[qr_settings][image_type]", "png");
    }
    return omiseRequest("/charges", {
        method: "POST",
        body: params,
    });
}
async function retrieveOmiseCharge(chargeId) {
    return omiseRequest(`/charges/${encodeURIComponent(chargeId)}`, {
        method: "GET",
    });
}
async function createOmiseRecipient(input) {
    const params = new URLSearchParams();
    params.set("name", input.name);
    if (input.email)
        params.set("email", input.email);
    params.set("type", "individual");
    params.set("bank_account[brand]", input.bankAccountBrand);
    params.set("bank_account[number]", input.bankAccountNumber);
    params.set("bank_account[name]", input.bankAccountName);
    return omiseRequest("/recipients", {
        method: "POST",
        body: params,
    });
}
async function createOmiseTransfer(input) {
    const params = new URLSearchParams();
    params.set("amount", String(input.amount));
    params.set("recipient", input.recipient);
    params.set("fail_fast", String(input.failFast ?? true));
    for (const [key, value] of Object.entries(input.metadata ?? {})) {
        params.set(`metadata[${key}]`, value);
    }
    return omiseRequest("/transfers", {
        method: "POST",
        body: params,
    });
}
async function downloadOmiseDocumentAsDataUri(downloadUri) {
    const secretKey = process.env.OMISE_PRIVATE_KEY;
    if (!secretKey) {
        throw new Error("OMISE_PRIVATE_KEY_NOT_CONFIGURED");
    }
    const url = new URL(downloadUri);
    const expectedHost = new URL(OMISE_API_BASE_URL).host;
    if (url.host !== expectedHost || !url.pathname.startsWith("/charges/")) {
        throw new Error("INVALID_OMISE_DOCUMENT_URL");
    }
    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Could not download Omise document: ${response.status}`);
    }
    const contentType = response.headers.get("content-type") || "image/svg+xml";
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString("base64")}`;
}
async function omiseRequest(path, init) {
    const secretKey = process.env.OMISE_PRIVATE_KEY;
    if (!secretKey) {
        throw new Error("OMISE_PRIVATE_KEY_NOT_CONFIGURED");
    }
    const response = await fetch(`${OMISE_API_BASE_URL}${path}`, {
        ...init,
        headers: {
            Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
            ...init.headers,
        },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = payload?.message ||
            payload?.code ||
            `Omise API request failed with status ${response.status}`;
        throw new Error(message);
    }
    return payload;
}
