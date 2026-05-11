import { Storage } from "@google-cloud/storage";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Dynamically resolve service account path if it's relative in .env
let keyFilename: string | undefined = process.env.GCP_KEY_FILEPATH;
if (!keyFilename && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // If relative path, resolve from project root.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith(".")) {
    keyFilename = path.resolve(__dirname, "../../../../", process.env.GOOGLE_APPLICATION_CREDENTIALS);
  } else {
    keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
}

// Initialize GCS
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_PROJECT_ID,
  ...(keyFilename ? { keyFilename } : {}),
});

const bucketName = process.env.GCS_BUCKET_NAME || "tutor-advantage-verification";
const bucket = storage.bucket(bucketName);

export async function uploadToGCS(
  file: Express.Multer.File,
  folder: string = "verification"
): Promise<string> {
  const fileExtension = path.extname(file.originalname);
  const fileName = `${folder}/${uuidv4()}${fileExtension}`;
  const blob = bucket.file(fileName);

  const blobStream = blob.createWriteStream({
    resumable: false,
    contentType: file.mimetype,
  });

  return new Promise((resolve, reject) => {
    blobStream.on("error", (err) => {
      reject(err);
    });

    blobStream.on("finish", () => {
      // The public URL can be used to access the file if it's public
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
}

export async function deleteFromGCS(publicUrl: string): Promise<void> {
  try {
    if (!publicUrl) return;
    // Format: https://storage.googleapis.com/[bucketName]/[folder]/[filename]
    const urlPrefix = `https://storage.googleapis.com/${bucket.name}/`;
    if (!publicUrl.startsWith(urlPrefix)) return; // Not in our bucket

    const relativePath = publicUrl.replace(urlPrefix, "");
    const file = bucket.file(relativePath);
    
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`Successfully deleted old object from GCS: ${relativePath}`);
    }
  } catch (error) {
    // Non-critical, don't crash if cleanup fails
    console.error("Failed to cleanup old object from GCS:", error);
  }
}
