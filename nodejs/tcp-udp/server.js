const fs = require("fs");
const http = require("http");
const https = require("https");
const net = require("net");
const dgram = require("dgram");
const path = require("path");

const HOST = process.argv[2];
const TCP_PORT = 3000;
const UDP_PORT = 3001;
const HTTP_PORT = 3002;
const HTTPS_PORT = 3004;
const certificateDirectory = path.join(__dirname, "certs");

function addRequestValues(request, response) {
    if (request.method !== "POST") {
        response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Only POST is supported");
        return;
    }

    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
        body += chunk;
    });
    request.on("end", () => {
        try {
            const { v } = JSON.parse(body);
            response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            response.end(`${v}ok`);
        } catch (error) {
            response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Request body must be JSON with v");
        }
    });
}

const tcpServer = net.createServer((socket) => {
    socket.on("data", (data) => {
        socket.write(Buffer.concat([data, Buffer.from("ok")]));
    });
});

tcpServer.listen(TCP_PORT, HOST, () => {
    console.log(`TCP listening on ${HOST}:${TCP_PORT}`);
});

const udpServer = dgram.createSocket("udp4");
udpServer.on("message", (message, remote) => {
    const response = Buffer.concat([message, Buffer.from("ok")]);
    udpServer.send(response, remote.port, remote.address);
});
udpServer.bind(UDP_PORT, HOST, () => {
    console.log(`UDP listening on ${HOST}:${UDP_PORT}`);
});

http.createServer(addRequestValues).listen(HTTP_PORT, HOST, () => {
    console.log(`HTTP listening on ${HOST}:${HTTP_PORT}`);
});

const keyPath = path.join(certificateDirectory, "server.key");
const certificatePath = path.join(certificateDirectory, "server.crt");
if (!fs.existsSync(keyPath) || !fs.existsSync(certificatePath)) {
    console.error(`HTTPS certificate files are required: ${keyPath} and ${certificatePath}`);
    process.exitCode = 1;
} else {
    https.createServer(
        {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certificatePath),
        },
        addRequestValues,
    ).listen(HTTPS_PORT, HOST, () => {
        console.log(`HTTPS listening on ${HOST}:${HTTPS_PORT}`);
    });
}



/*
https_host=192.168.1.101

MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout nodejs/tcp-udp/certs/server.key \
  -out nodejs/tcp-udp/certs/server.crt \
  -days 365 \
  -subj "/CN=${https_host}" \
  -addext "subjectAltName=IP:${https_host}"
*/

//node nodejs/tcp-udp/server.js 192.168.1.101


