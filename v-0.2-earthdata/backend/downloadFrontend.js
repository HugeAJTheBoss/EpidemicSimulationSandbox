import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: "./frontend.env" });

const supabase = createClient(
  process.env.PROJECT_URL,
  process.env.API_KEY
);

const bucket = process.env.BUCKET_NAME;

const downloadInterval = 50; // ms

let downloadCount = 0;
let startTime = Date.now();

async function downloadSpecific() {
  const fileName = "settings.json";

  const { data: fileData, error } = await supabase.storage
    .from(bucket)
    .download(fileName);

  if (error) {
    console.error("Download error:", error.message);
    return;
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  fs.writeFileSync(`./${fileName}`, buffer);

  downloadCount++;

  // Every 10 downloads, print downloads/sec
  if (downloadCount % 10 === 0) {
    const elapsed = (Date.now() - startTime) / 1000; // seconds
    const dps = (downloadCount / elapsed).toFixed(2);
    console.log(`Downloads per second: ${dps}`);
  }
}

setInterval(downloadSpecific, downloadInterval);
