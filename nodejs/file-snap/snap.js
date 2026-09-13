

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import hashwasm from "hash-wasm";

const { createXXHash128 } = hashwasm; // XXH3-128
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const SNAP_RE = /^(?:.+_)?\d{6,8}_\d{6}(-\d+)?\.json$/;
const CHUNK = 1 << 20; // 1 MiB streaming read
const WORKERS = 4;     // Concurrent hash workers

function usage() {
    return [
        "Usage:",
        "  node snap.js -f <folder>",
        "  node snap.js -json1 <file> -json2 <file>",
        "  node snap.js -f <folder> -json1 <file> -json2 <file>",
    ].join("\n");
}

function die(msg) {
    console.error(`Error: ${msg}`);
    console.error(usage());
    process.exit(2);
}

function parseArgs(args) {
    let folder;
    let json1;
    let json2;

    for (let i = 0; i < args.length; i++) {
        const option = args[i];
        if (!["-f", "-json1", "-json2"].includes(option)) {
            die(`Unknown option: ${option}`);
        }

        const value = args[++i];
        if (!value || value.startsWith("-")) {
            die(`Missing value for ${option}`);
        }

        if (option === "-f") folder = value;
        else if (option === "-json1") json1 = value;
        else json2 = value;
    }

    if (!folder && !json1 && !json2) die("No operation specified");
    if ((json1 && !json2) || (!json1 && json2)) {
        die("Both -json1 and -json2 are required for comparison");
    }

    return { folder, json1, json2 };
}


function stamp(d) {
    return `${pad(d.getFullYear() % 100)}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
        `_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;


    function pad(n, w = 2) {
        return String(n).padStart(w, "0");
    }
}

function collectFiles(root) {
    const out = [];
    const walk = (dir, rel) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            if (ent.isSymbolicLink()) continue;
            const abs = path.join(dir, ent.name);
            const r = rel ? `${rel}/${ent.name}` : ent.name;
            if (ent.isDirectory()) walk(abs, r);
            else if (ent.isFile() && !SNAP_RE.test(ent.name)) out.push({ abs, rel: r });
        }
    };
    walk(root, "");
    out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
    return out;
}

async function hashFile(hasher, abs) {
    const fh = await fs.promises.open(abs, "r");
    const buf = Buffer.alloc(CHUNK);
    let len = 0;
    try {
        for (; ;) {
            const { bytesRead } = await fh.read(buf, 0, CHUNK, null);
            if (!bytesRead) break;
            hasher.update(buf.subarray(0, bytesRead));
            len += bytesRead;
        }
    } finally {
        await fh.close();
    }
    return len;
}

async function makeSnapshot(rootArg) {
    const root = path.resolve(rootArg);
    if (!fs.statSync(root).isDirectory()) die(`Not a folder: ${root}`);

    const files = collectFiles(root);
    const result = {};
    let idx = 0;

    const worker = async () => {
        const hasher = await createXXHash128();
        for (; ;) {
            const i = idx++;
            if (i >= files.length) break;
            const f = files[i];
            hasher.init();
            const len = await hashFile(hasher, f.abs);
            result[f.rel] = { len, xxh3128: hasher.digest("hex") };
            console.log(`${f.rel} ${result[f.rel].len} ${result[f.rel].xxh3128}`);
        }
    };
    await Promise.all(Array.from({ length: Math.min(WORKERS, files.length) || 1 }, worker));

    const folderName = path.basename(root);
    let outPath = path.join(SCRIPT_DIR, `${folderName}_${stamp(new Date())}.json`);
    for (let n = 1; fs.existsSync(outPath); n++) {
        outPath = path.join(SCRIPT_DIR, `${folderName}_${stamp(new Date())}-${n}.json`);
    }
    fs.writeFileSync(outPath, JSON.stringify(result));
    console.log(`Snapshot complete: ${files.length} files -> ${outPath}`);
}

function resolveSnapshotPath(fileArg) {
    return path.resolve(SCRIPT_DIR, fileArg);
}

function compareSnapshots(data1Path, data2Path) {
    data1Path = resolveSnapshotPath(data1Path);
    data2Path = resolveSnapshotPath(data2Path);
    for (const filePath of [data1Path, data2Path]) {
        if (!fs.existsSync(filePath)) die(`Snapshot file not found: ${filePath}`);
    }
    const data1 = JSON.parse(fs.readFileSync(data1Path, "utf8"));
    const data2 = JSON.parse(fs.readFileSync(data2Path, "utf8"));

    const only1 = [];
    const only2 = [];
    const diff = [];
    for (const k of Object.keys(data1)) {
        if (!(k in data2)) only1.push(k);
        else if (data1[k].len !== data2[k].len || data1[k].xxh3128 !== data2[k].xxh3128) diff.push(k);
    }
    for (const k of Object.keys(data2)) {
        if (!(k in data1)) only2.push(k);
    }

    console.log(`
json1: ${Object.keys(data1).length} files / json2: ${Object.keys(data2).length} files

=====Only in json1 (${only1.length})=====
${only1.sort().map(k => `${k}`).join("\n")}

=====Only in json2 (${only2.length})=====
${only2.sort().map(k => `${k}`).join("\n")}

=====Different files (${diff.length})=====
${diff.sort().map(k => `${k}`).join("\n")}`);

    process.exitCode = (only1.length || only2.length || diff.length) ? 1 : 0;
}

const parsedArgs = parseArgs(process.argv.slice(2));
const folder = parsedArgs.folder;
const json1 = parsedArgs.json1;
const json2 = parsedArgs.json2;
if (folder) {
    if (!fs.existsSync(folder)) die(`Folder not found: ${folder}`);
    if (!fs.statSync(folder).isDirectory()) die(`Not a folder: ${folder}`);
    await makeSnapshot(folder);
}
if (json1 && json2) compareSnapshots(json1, json2);






// node nodejs/file-snap/snap.js -f "C:\my-folder"
// node nodejs/file-snap/snap.js -json1 "my-folder_260913_131809.json" -json2 "my-folder_260913_131811.json"




