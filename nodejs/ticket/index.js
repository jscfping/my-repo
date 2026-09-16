const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const multer = require("multer");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const [portArgument, ticketFolder, ticketLog] = process.argv.slice(2);
const port = Number(portArgument);

if (!port || !ticketFolder || !ticketLog) {
    console.error("Port, ticket folder, and ticket log must be specified");
    process.exit(1);
}

function formatTimestamp(date = new Date()) {
    const yy = String(date.getFullYear()).slice(-2);
    const MM = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const HH = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");

    return `${yy}${MM}${dd}_${HH}${mm}${ss}`;
}


app.get("/", (req, res) => {
    res.type("text/plain").send(`curl -X POST http://localhost:3000/tickets -F "title=title" -F "content=content" -F "files=@/c/temp/test.txt"`);
});

app.post("/tickets", upload.array("files"), async (req, res, next) => {
    try {
        if (typeof req.body.title !== "string" || typeof req.body.content !== "string") {
            return res.status(400).type("text/plain").send("title and content are required");
        }

        const files = req.files || [];
        const filenames = new Set();
        const safeFiles = files.map((file) => {
            const filename = path.win32.basename(file.originalname);
            const key = filename.toLowerCase();

            if (!filename || filename === "." || filename === ".." || filenames.has(key)) {
                return null;
            }

            filenames.add(key);
            return { filename, buffer: file.buffer };
        });

        if (safeFiles.some((file) => file === null)) {
            return res.status(400).type("text/plain").send("duplicate filename");
        }

        const timestamp = formatTimestamp();
        const ticketPath = path.join(ticketFolder, timestamp);

        await fs.mkdir(ticketFolder, { recursive: true });
        await fs.mkdir(ticketPath);
        await fs.mkdir(ticketLog, { recursive: true });

        await fs.writeFile(
            path.join(ticketPath, "README.md"),
            `# ${req.body.title}\n${req.body.content}\n`,
            "utf8"
        );

        await Promise.all(
            safeFiles.map(({ filename, buffer }) =>
                fs.writeFile(path.join(ticketPath, filename), buffer)
            )
        );

        await fs.writeFile(path.join(ticketLog, timestamp), "");

        return res.type("text/plain").send(timestamp);
    } catch (error) {
        if (error.code === "EEXIST") {
            return res.status(409).type("text/plain").send("ticket already exists");
        }

        return next(error);
    }
});

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).type("text/plain").send(error.message);
    }

    return next(error);
});

app.use((error, req, res, next) => {
    console.error(error);
    return res.status(500).type("text/plain").send("internal server error");
});


app.listen(port, () => {
    console.log(`Ticket API listening on http://localhost:${port}`);
});



// node index.js 3000 "C:\\tickets" "C:\\ticket_log"





