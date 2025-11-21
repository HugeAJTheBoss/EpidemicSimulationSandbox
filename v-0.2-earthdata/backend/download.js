import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: "./backend.env" });

const supabase = createClient(
  process.env.PROJECT_URL,
  process.env.API_KEY
);

const bucket = process.env.BUCKET_NAME;

async function downloadSpecific() {
  const fileName = "sim_frame.bin";

  // Download the file
  const { data: fileData, error } = await supabase.storage
    .from(bucket)
    .download(fileName);

  if (error) {
    console.error("Download error:", error.message);
    return;
  }

  // Convert to buffer + save locally
  const buffer = Buffer.from(await fileData.arrayBuffer());
  fs.writeFileSync(`./${fileName}`, buffer);

  console.log(`Downloaded and saved locally as ${fileName}`);
}

downloadSpecific();
