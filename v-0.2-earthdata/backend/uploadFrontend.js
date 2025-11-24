import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";

// Load frontend.env
dotenv.config({ path: "./frontend.env" });

// Create Supabase client
const supabase = createClient(
  process.env.PROJECT_URL,
  process.env.API_KEY
);

const bucket = process.env.BUCKET_NAME;

// Load the JSON file once
const filePath = "./settings.json";
const fileBuffer = fs.readFileSync(filePath);

console.log("Loaded file:", filePath);

// Upload interval
const uploadInterval = 60;

let uploadCount = 0;
let startTime = Date.now();

async function uploadFile() {
  try {
    const fileName = "settings.json";

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType: "application/json",
        upsert: true
      });

    if (error) throw error;

    uploadCount++;

    // Every 10 uploads → report uploads/sec
    if (uploadCount % 10 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const ups = (uploadCount / elapsed).toFixed(2);
      console.log(`Uploads per second: ${ups}`);
    }

  } catch (err) {
    console.error("❌ Upload error:", err.message);
  }
}

setInterval(uploadFile, uploadInterval);
