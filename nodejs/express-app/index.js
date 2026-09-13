
const express = require("express");
const { spawn } = require("child_process");
const app = express();

const path = require("path");
app.use(express.json());
app.use("/static", express.static(path.join(__dirname, "static")));
///static/

app.get("/", (req, res) => {
    res.send("Hello World!");
});


// curl -N -X POST http://localhost:3000/spawn -H 'Content-Type: application/json' --data-raw '{"cmd":"powershell.exe","args":["-NoProfile","-NonInteractive","-Command","[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; dir C:\\"]}'
// curl -N -X POST http://localhost:3000/spawn -H 'Content-Type: application/json' --data-raw '{"cmd":"bash","args":["-lc","ls /c"]}'

app.post("/spawn", (req, res) => {
    const { cmd, args = [] } = req.body ?? {};

    if (typeof cmd !== "string"
        || cmd.trim() === ""
        || !Array.isArray(args)
        || args.some((arg) => typeof arg !== "string")) {
        return res.status(400).json({
            error: "cmd must be a non-empty string and args must be an array of strings",
        });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.flushHeaders();

    const child = spawn(cmd, args);

    child.stdout.on("data", (chunk) => {
        res.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
        res.write(chunk);
    });

    child.on("error", (error) => {
        res.write(`[spawn error] ${error.message}\n`);
        res.end();
    });

    child.on("close", () => {
        if (!res.writableEnded) {
            res.end();
        }
    });

    res.on("close", () => {
        if (!child.killed) {
            child.kill();
        }
    });
});


const port = process.argv[2];

if (!port) throw new Error("Port number must be specified as the first argument");

app.listen(port, () => {
    console.log(`listening on port http://localhost:${port}`)
});


// node nodejs/express-app/index.js 3000



