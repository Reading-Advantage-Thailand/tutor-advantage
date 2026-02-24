import dotenv from "dotenv";

// Load environment variables from .env if present
dotenv.config();

export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};
