

import fs from "node:fs";
import path from "node:path";

[
    "abc.txt",
].map(path => [`C:\\${path}`, `C:\\a\\${path}`]).forEach(([p1, p2]) => {
    try {
        fs.mkdirSync(path.dirname(p2), { recursive: true });
        fs.copyFileSync(p1, p2);
        console.log(`Copied from ${p1} to ${p2}`);
    } catch (e) {
        console.error(`Failed to copy from ${p1} to ${p2}: ${e.message}`);
    }
});



// node nodejs/file-snap/copyFiles.js



