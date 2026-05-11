"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = uploadFile;
const storage_1 = require("../lib/storage");
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
        console.error("Upload File Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not upload file",
                requestId: req.id,
            },
        });
    }
}
