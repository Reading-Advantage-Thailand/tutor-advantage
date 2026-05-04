import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from learning-service
dotenv.config({ path: path.join(__dirname, "../services/learning-service/.env") });

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
  try {
    const result = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // dummy call to check connection
    console.log("Testing connection...");
    
    // In some SDK versions, we use the client directly
    const models = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`);
    const data = await models.json();
    
    if (data.models) {
      console.log("Available Models:");
      data.models.forEach((m: any) => console.log(`- ${m.name}`));
    } else {
      console.log("No models found or error:", data);
    }
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
