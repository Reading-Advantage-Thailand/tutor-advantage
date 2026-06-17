"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToGCS = uploadToGCS;
exports.deleteFromGCS = deleteFromGCS;
const storage_1 = require("@google-cloud/storage");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const shared_config_1 = require("@tutor-advantage/shared-config");
// Dynamically resolve service account path if it's relative in .env
let keyFilename = process.env.GCP_KEY_FILEPATH;
if (!keyFilename && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // If relative path, resolve from project root.
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith(".")) {
        keyFilename = path_1.default.resolve(__dirname, "../../../../", process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
    else {
        keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
}
// Initialize GCS
const storage = new storage_1.Storage({
    projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_PROJECT_ID,
    ...(keyFilename ? { keyFilename } : {}),
});
const bucketName = process.env.GCS_BUCKET_NAME || "tutor-advantage-verification";
const bucket = storage.bucket(bucketName);
async function uploadToGCS(file, folder = "verification") {
    const fileExtension = path_1.default.extname(file.originalname);
    const fileName = `${folder}/${(0, uuid_1.v4)()}${fileExtension}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: file.mimetype,
    });
    return new Promise((resolve, reject) => {
        blobStream.on("error", (err) => {
            reject(err);
        });
        blobStream.on("finish", async () => {
            try {
                // Generate a signed URL instead of a public URL to secure sensitive documents
                const [signedUrl] = await blob.getSignedUrl({
                    action: "read",
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days expiration
                });
                resolve(signedUrl);
            }
            catch (err) {
                reject(err);
            }
        });
        blobStream.end(file.buffer);
    });
}
async function deleteFromGCS(publicUrl) {
    try {
        if (!publicUrl)
            return;
        // Format: https://storage.googleapis.com/[bucketName]/[folder]/[filename]
        const urlPrefix = `https://storage.googleapis.com/${bucket.name}/`;
        if (!publicUrl.startsWith(urlPrefix))
            return; // Not in our bucket
        const relativePath = publicUrl.replace(urlPrefix, "");
        const file = bucket.file(relativePath);
        const [exists] = await file.exists();
        if (exists) {
            await file.delete();
            shared_config_1.logger.info(`Successfully deleted old object from GCS: ${relativePath}`);
        }
    }
    catch (error) {
        // Non-critical, don't crash if cleanup fails
        const err = error;
        shared_config_1.logger.error("Failed to cleanup old object from GCS:", err);
    }
}
