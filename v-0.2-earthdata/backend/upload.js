import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";

// Load backend.env
dotenv.config({ path: "./backend.env" });

// Create Supabase client using YOUR variable names
const supabase = createClient(
  process.env.PROJECT_URL,
  process.env.API_KEY
);

const bucket = process.env.BUCKET_NAME;

// Path to the .bin file
const filePath = "./earthdata_rgb.bin";
const fileBuffer = fs.readFileSync(filePath);

console.log("Loaded file:", filePath);

// Upload every 250ms
const uploadInterval = 250;

async function uploadFile() {
  try {
    const timestamp = Date.now();
    const fileName = `sim_frame.bin`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType: "application/octet-stream",
        upsert: true
      });

    if (error) throw error;

    console.log(`✅ Uploaded: ${fileName}`);
  } catch (err) {
    console.error("❌ Upload error:", err.message);
  }
}

setInterval(uploadFile, uploadInterval);
