import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "dist/web";
const candidates = walk(root).filter((file) => /\.(html|css)$/i.test(file));
const externalAsset = /(?:src|href)=["']https?:|url\(\s*["']?https?:/i;

for (const file of candidates) {
  const contents = readFileSync(file, "utf8");
  if (externalAsset.test(contents)) {
    console.error(`External runtime asset reference found in ${file}`);
    process.exit(1);
  }
}

if (!candidates.some((file) => file.endsWith("index.html"))) {
  console.error("Built web entrypoint is missing");
  process.exit(1);
}

console.log(`Verified ${candidates.length} built HTML/CSS files with no external asset references.`);

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
