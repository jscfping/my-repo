const http = require("http");
const https = require("https");
const net = require("net");
const dgram = require("dgram");

const host = process.argv[2];
const tcpPort = 3000;
const udpPort = 3001;
const httpPort = 3002;
const httpsPort = 3004;

function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sendTcp(message) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port: tcpPort });
        let response = "";
        socket.setEncoding("utf8");
        socket.on("connect", () => socket.write(message));
        socket.on("data", (chunk) => {
            response += chunk;
            socket.end();
        });
        socket.on("end", () => resolve(response));
        socket.on("error", reject);
    });
}

function sendUdp(message) {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket("udp4");
        const data = Buffer.from(message);
        socket.once("message", (response) => {
            socket.close();
            resolve(response.toString());
        });
        socket.once("error", (error) => {
            socket.close();
            reject(error);
        });
        socket.send(data, udpPort, host);
    });
}

function sendHttp(port, data, secure = false) {
    const content = JSON.stringify(data);
    return new Promise((resolve, reject) => {
        const request = (secure ? https : http).request(
            {
                host,
                port,
                path: "/",
                method: "POST",
                rejectUnauthorized: false,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(content),
                },
            },
            (response) => {
                let responseBody = "";
                response.setEncoding("utf8");
                response.on("data", (chunk) => {
                    responseBody += chunk;
                });
                response.on("end", () => resolve(responseBody));
            },
        );
        request.on("error", reject);
        request.end(content);
    });
}

async function main() {
    while (true) {
        console.log("TCP:", await sendTcp(String(Date.now())));
        await wait(500);

        console.log("UDP:", await sendUdp(String(Date.now())));
        await wait(500);

        console.log("HTTP:", await sendHttp(httpPort, { v: String(Date.now()) }));
        await wait(500);

        console.log("HTTPS:", await sendHttp(httpsPort, { v: String(Date.now()) }, true));
        await wait(500);
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});



//node nodejs/tcp-udp/client.js 192.168.1.101


