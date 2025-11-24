import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";

// Load backend.env
dotenv.config({ path: "./backend.env" });

// Create Supabase client
const supabase = createClient(
  process.env.PROJECT_URL,
  process.env.API_KEY
);

const bucket = process.env.BUCKET_NAME;

// Load file buffer once
const filePath = "./earthdata_rgb.bin";
const fileBuffer = fs.readFileSync(filePath);

console.log("Loaded file:", filePath);

// Upload every 60ms
const uploadInterval = 60;

let uploadCount = 0;
let startTime = Date.now();

async function uploadFile() {
  try {
    const fileName = "sim_frame.bin";

    const { data, error } = await supabase.storage
      .from(bucket)
      .update(fileName, fileBuffer, {
        contentType: "application/octet-stream",
        upsert: true
      });

    // If error, try to extract the raw HTML page
    if (error) {
      if (error.response) {
        const html = await error.response.text();
        console.log("----- RAW SERVER HTML ERROR -----");
        console.log(html);
        console.log("----- END HTML ERROR -----");
      }
      throw error;
    }

    uploadCount++;

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
