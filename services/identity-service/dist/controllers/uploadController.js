"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = uploadFile;
const storage_1 = require("../lib/storage");
const shared_config_1 = require("@tutor-advantage/shared-config");
async function uploadFile(req, res) {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({
                error: { code: "BAD_REQUEST", message: "No file uploaded" },
            });
        }
        const publicUrl = await (0, storage_1.uploadToGCS)(file);
        return res.status(200).json({ url: publicUrl });
    }
    catch (error) {
        const err = error;
        shared_config_1.logger.error("Upload File Error:", err);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not upload file",
                requestId: req.id,
            },
        });
    }
}
