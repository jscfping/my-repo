const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const multer = require("multer");

const MAX_FILES = 20;
const TEMP_FILE_PREFIX = ".file-server-upload-";

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function isWithinRoot(root, target) {
    const relative = path.relative(root, target);
    return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function isSafeName(name) {
    if (typeof name !== "string" || name === "" || name === "." || name === "..") {
        return false;
    }

    if (name.includes("\0") || /[<>:"/\\|?*]/.test(name) || /[. ]$/.test(name)) {
        return false;
    }

    return !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name);
}

function uploadName(originalName) {
    if (typeof originalName !== "string" || originalName.includes("\0")) {
        return null;
    }

    const name = path.posix.basename(path.win32.basename(originalName));
    return isSafeName(name) ? name : null;
}

async function createApp({ rootDirectory }) {
    const root = await fs.realpath(rootDirectory);
    const rootStat = await fs.stat(root);
    if (!rootStat.isDirectory()) {
        throw new Error("The shared path must be a directory");
    }

    const app = express();
    const upload = multer({
        storage: multer.diskStorage({
            destination: (_req, _file, callback) => callback(null, os.tmpdir()),
            filename: (_req, _file, callback) => callback(null, `file-server-${crypto.randomUUID()}`)
        }),
        limits: {
            files: MAX_FILES,
            fields: 1,
            fieldSize: 4096,
            parts: MAX_FILES + 1
        }
    });

    async function resolveDirectory(relativeDirectory) {
        if (typeof relativeDirectory !== "string" || path.isAbsolute(relativeDirectory) || path.win32.isAbsolute(relativeDirectory)) {
            throw new HttpError(400, "資料夾路徑無效");
        }

        const segments = relativeDirectory.replace(/\\/g, "/").split("/").filter(Boolean);
        if (segments.some((segment) => segment === "." || segment === ".." || !isSafeName(segment))) {
            throw new HttpError(400, "資料夾路徑無效");
        }

        let current = root;
        for (const segment of segments) {
            current = path.join(current, segment);
            if (!isWithinRoot(root, current)) {
                throw new HttpError(400, "資料夾路徑無效");
            }

            let stat;
            try {
                stat = await fs.lstat(current);
            } catch (error) {
                if (error.code === "ENOENT") {
                    throw new HttpError(404, "找不到資料夾");
                }
                throw error;
            }

            if (stat.isSymbolicLink() || !stat.isDirectory()) {
                throw new HttpError(400, "不允許存取連結或非資料夾路徑");
            }
        }

        const realDirectory = await fs.realpath(current);
        if (!isWithinRoot(root, realDirectory)) {
            throw new HttpError(400, "資料夾路徑無效");
        }

        return {
            path: current,
            relative: segments.join("/"),
            parent: segments.slice(0, -1).join("/")
        };
    }

    async function resolveFile(directory, name) {
        if (!isSafeName(name)) {
            throw new HttpError(400, "檔名無效");
        }

        const filePath = path.join(directory.path, name);
        if (!isWithinRoot(root, filePath)) {
            throw new HttpError(400, "檔案路徑無效");
        }

        let stat;
        try {
            stat = await fs.lstat(filePath);
        } catch (error) {
            if (error.code === "ENOENT") {
                throw new HttpError(404, "找不到檔案");
            }
            throw error;
        }

        if (stat.isSymbolicLink() || !stat.isFile()) {
            throw new HttpError(400, "僅能操作一般檔案");
        }

        return filePath;
    }

    app.use(express.static(path.join(__dirname, "public"), { index: "index.html" }));
    app.use(express.json({ limit: "16kb" }));

    app.get("/api/files", async (req, res) => {
        const directory = await resolveDirectory(req.query.directory ?? "");
        const entries = await fs.readdir(directory.path, { withFileTypes: true });
        const files = await Promise.all(entries.map(async (entry) => {
            if (entry.name.startsWith(TEMP_FILE_PREFIX)) {
                return null;
            }

            const filePath = path.join(directory.path, entry.name);
            const stat = await fs.lstat(filePath);
            if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
                return null;
            }

            return {
                name: entry.name,
                type: stat.isDirectory() ? "directory" : "file",
                size: stat.isFile() ? stat.size : null,
                modifiedAt: stat.mtime.toISOString()
            };
        }));

        files.sort((a, b) => {
            if (!a) return 1;
            if (!b) return -1;
            if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
            return a.name.localeCompare(b.name, "zh-TW", { numeric: true, sensitivity: "base" });
        });

        res.json({
            directory: directory.relative,
            parent: directory.relative ? directory.parent : null,
            entries: files.filter(Boolean)
        });
    });

    app.get("/api/download", async (req, res, next) => {
        try {
            const directory = await resolveDirectory(req.query.directory ?? "");
            const filePath = await resolveFile(directory, req.query.name);
            res.download(filePath, req.query.name, (error) => {
                if (error && !res.headersSent) next(error);
            });
        } catch (error) {
            next(error);
        }
    });

    app.post("/api/upload", upload.array("files", MAX_FILES), async (req, res, next) => {
        const files = req.files || [];
        const stagedFiles = [];
        try {
            if (files.length === 0) {
                throw new HttpError(400, "請選擇至少一個檔案");
            }

            const directory = await resolveDirectory(req.body.directory ?? "");
            const names = files.map((file) => uploadName(file.originalname));
            if (names.some((name) => name === null)) {
                throw new HttpError(400, "檔名包含不支援的字元");
            }

            const uniqueNames = new Set(names.map((name) => name.toLocaleLowerCase("en-US")));
            if (uniqueNames.size !== names.length) {
                throw new HttpError(400, "同一批上傳不可包含重複檔名");
            }

            const destinations = [];
            for (const name of names) {
                const destination = path.join(directory.path, name);
                if (!isWithinRoot(root, destination)) {
                    throw new HttpError(400, "檔案路徑無效");
                }

                try {
                    const existing = await fs.lstat(destination);
                    if (existing.isSymbolicLink() || !existing.isFile()) {
                        throw new HttpError(400, `無法覆寫：${name}`);
                    }
                } catch (error) {
                    if (error.code !== "ENOENT") throw error;
                }

                destinations.push(destination);
            }

            for (let index = 0; index < files.length; index += 1) {
                const stagedPath = path.join(directory.path, `${TEMP_FILE_PREFIX}${crypto.randomUUID()}`);
                stagedFiles.push(stagedPath);
                await fs.copyFile(files[index].path, stagedPath, fs.constants.COPYFILE_EXCL);
                await fs.rename(stagedPath, destinations[index]);
            }

            res.json({ uploaded: names });
        } catch (error) {
            next(error);
        } finally {
            await Promise.all(files.map((file) => fs.rm(file.path, { force: true })));
            await Promise.all(stagedFiles.map((filePath) => fs.rm(filePath, { force: true })));
        }
    });

    app.post("/api/folders", async (req, res) => {
        const directory = await resolveDirectory(req.body?.directory ?? "");
        const name = req.body?.name;
        if (!isSafeName(name)) {
            throw new HttpError(400, "資料夾名稱無效");
        }

        const folderPath = path.join(directory.path, name);
        if (!isWithinRoot(root, folderPath)) {
            throw new HttpError(400, "資料夾路徑無效");
        }

        try {
            await fs.mkdir(folderPath);
        } catch (error) {
            if (error.code === "EEXIST") {
                throw new HttpError(409, "同名檔案或資料夾已存在");
            }
            throw error;
        }

        res.status(201).json({ created: name });
    });

    app.delete("/api/folders", async (req, res) => {
        const directory = await resolveDirectory(req.body?.directory ?? "");
        const name = req.body?.name;
        if (!isSafeName(name)) {
            throw new HttpError(400, "資料夾名稱無效");
        }

        const folderPath = path.join(directory.path, name);
        if (!isWithinRoot(root, folderPath)) {
            throw new HttpError(400, "資料夾路徑無效");
        }

        let stat;
        try {
            stat = await fs.lstat(folderPath);
        } catch (error) {
            if (error.code === "ENOENT") {
                throw new HttpError(404, "找不到資料夾");
            }
            throw error;
        }

        if (stat.isSymbolicLink() || !stat.isDirectory()) {
            throw new HttpError(400, "僅能刪除一般資料夾");
        }

        const realFolder = await fs.realpath(folderPath);
        if (!isWithinRoot(root, realFolder) || realFolder === root) {
            throw new HttpError(400, "無法刪除共享根資料夾");
        }

        await fs.rm(folderPath, { recursive: true });
        res.json({ deleted: name });
    });

    app.delete("/api/files", async (req, res) => {
        const directory = await resolveDirectory(req.body?.directory ?? "");
        const filePath = await resolveFile(directory, req.body?.name);
        await fs.unlink(filePath);
        res.json({ deleted: req.body.name });
    });

    app.use((error, _req, res, next) => {
        if (res.headersSent) return next(error);

        if (error instanceof multer.MulterError) {
            const message = error.code === "LIMIT_FILE_COUNT"
                ? `一次最多上傳 ${MAX_FILES} 個檔案`
                : error.message;
            return res.status(400).json({ error: message });
        }

        const status = error instanceof HttpError ? error.status : 500;
        if (status >= 500) console.error(error);
        return res.status(status).json({
            error: status >= 500 ? "伺服器內部錯誤" : error.message
        });
    });

    return app;
}

async function main() {
    const [directoryArgument] = process.argv.slice(2);
    if (!directoryArgument) {
        console.error('請提供要分享的資料夾，例如：node index.js "C:\\資料\\共享"');
        process.exitCode = 1;
        return;
    }

    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error("PORT 必須是 1 到 65535 之間的整數");
        process.exitCode = 1;
        return;
    }

    try {
        const app = await createApp({ rootDirectory: path.resolve(directoryArgument) });
        const server = http.createServer({ requestTimeout: 0 }, app);
        server.listen(port, "0.0.0.0", () => {
            console.log(`檔案伺服器已啟動：http://localhost:${port}`);
            console.log("區域網路其他裝置請使用這台電腦的區域網路 IP。");
        });
    } catch (error) {
        console.error(`無法啟動檔案伺服器：${error.message}`);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}

module.exports = { createApp };
