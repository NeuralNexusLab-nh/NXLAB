const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());
app.set("trust proxy", true);

const PORT = process.env.PORT || 10000;
var lastReq = 0;

// Middleware
app.use((req, res, next) => {
    try {
        console.log(
            "IP:", req.ip,
            "PATH:", req.path,
            "UA:", req.headers["user-agent"],
            "BODY:", JSON.stringify(req.body || {})
        );
    } catch {}
    next();
});

// API Functions

// ==================== API 核心功能對照表 ====================

const apifunc = {
  // 1. IP 查詢
  "ip": (reqo, resp, data) => {
    const clientIp = reqo.ip;
    resp.send(clientIp);
  },

  // 2. 文字回顯 (Echo) - 直接回傳原始資料，由前端 textContent 安全渲染
  "echo": (reqo, resp, data) => {
    resp.send(data);
  },

  // 3. Base64 編碼
  "base64ec": (reqo, resp, data) => {
    const encoded = Buffer.from(data).toString("base64");
    resp.send(encoded);
  },

  // 4. Base64 解碼 - 直接回傳原始資料
  "base64dc": (reqo, resp, data) => {
    const decoded = Buffer.from(data, "base64").toString("utf-8");
    resp.send(decoded);
  },

  // 5. HTTP 探測 (預設 HTTPS，失敗自動降級 HTTP) - 不再進行 escapeHtml
  "http": (reqo, resp, data) => {
    let url = data.trim();
    if (!url) {
      resp.send("Error: URL is required.");
      return;
    }

    const hasProtocol = /^https?:\/\//i.test(url);
    if (!hasProtocol) {
      url = "https://" + url;
    }

    const executeFetch = (targetUrl, allowFallback) => {
      fetch(targetUrl)
        .then((resObj) => {
          let output = `[Status] ${resObj.status}\n\n[Headers]\n`;
          resObj.headers.forEach((value, key) => {
            output += `  ${key}: ${value}\n`;
          });
          output += `\n[Body]\n`;

          resObj.text()
            .then((bodyText) => {
              const truncatedBody = bodyText.length > 500 ? bodyText.slice(0, 500) + "\n... (truncated)" : bodyText;
              output += truncatedBody;
              resp.send(output);
            })
            .catch((err) => {
              resp.send(`HTTP Read Error: ${err.message}`);
            });
        })
        .catch((err) => {
          if (allowFallback && targetUrl.startsWith("https://")) {
            const fallbackUrl = targetUrl.replace("https://", "http://");
            executeFetch(fallbackUrl, false);
          } else {
            resp.send(`HTTP Error: ${err.message}`);
          }
        });
    };

    executeFetch(url, !hasProtocol);
  },

  // 6. TCP 連線測試
  "tcp": (reqo, resp, data) => {
    const parts = data.trim().split(/\s+/);
    const host = parts[0];
    const port = parseInt(parts[1], 10);

    if (!host || isNaN(port)) {
      resp.send("Error: Usage is 'tcp [host] [port]'");
      return;
    }

    if (!isSafeHost(host)) {
      resp.send("Error: Access Denied. Host contains illegal characters.");
      return;
    }

    const net = require("net");
    const client = new net.Socket();
    client.setTimeout(3000);

    client.connect(port, host, () => {
      resp.send(`TCP Connection Success: Connected to ${host}:${port}`);
      client.destroy();
    });

    client.on("error", (err) => {
      resp.send(`TCP Connection Failed: ${err.message}`);
    });

    client.on("timeout", () => {
      resp.send("TCP Connection Failed: Timeout (3s)");
      client.destroy();
    });
  },

  // 7. UDP 封包發送
  "udp": (reqo, resp, data) => {
    const parts = data.trim().split(/\s+/);
    const host = parts[0];
    const port = parseInt(parts[1], 10);
    const message = parts.slice(2).join(" ") || "NXLAB UDP Payload";

    if (!host || isNaN(port)) {
      resp.send("Error: Usage is 'udp [host] [port] [message]'");
      return;
    }

    if (!isSafeHost(host)) {
      resp.send("Error: Access Denied. Host contains illegal characters.");
      return;
    }

    const dgram = require("dgram");
    const client = dgram.createSocket("udp4");
    const payload = Buffer.from(message);

    client.send(payload, port, host, (err) => {
      if (err) {
        resp.send(`UDP Send Error: ${err.message}`);
      } else {
        resp.send(`UDP Packet Sent Successfully to ${host}:${port}`);
      }
      client.close();
    });
  },

  // 8. 數學：加法
  "sum": (reqo, resp, data) => {
    const parts = data.trim().split(/\s+/);
    const num1 = parseFloat(parts[0]);
    const num2 = parseFloat(parts[1]);

    if (isNaN(num1) || isNaN(num2)) {
      resp.send("Error: Usage is 'sum [num1] [num2]'");
      return;
    }

    const result = num1 + num2;
    resp.send(result.toString());
  },

  // 9. 數學：減法
  "subtract": (reqo, resp, data) => {
    const parts = data.trim().split(/\s+/);
    const num1 = parseFloat(parts[0]);
    const num2 = parseFloat(parts[1]);

    if (isNaN(num1) || isNaN(num2)) {
      resp.send("Error: Usage is 'subtract [num1] [num2]'");
      return;
    }

    const result = num1 - num2;
    resp.send(result.toString());
  },

  // 10. 數學：乘法
  "multiply": (reqo, resp, data) => {
    const parts = data.trim().split(/\s+/);
    const num1 = parseFloat(parts[0]);
    const num2 = parseFloat(parts[1]);

    if (isNaN(num1) || isNaN(num2)) {
      resp.send("Error: Usage is 'multiply [num1] [num2]'");
      return;
    }

    const result = num1 * num2;
    resp.send(result.toString());
  },

  // 11. 數學：除法
  "divide": (reqo, resp, data) => {
    const parts = data.trim().split(/\s+/);
    const num1 = parseFloat(parts[0]);
    const num2 = parseFloat(parts[1]);

    if (isNaN(num1) || isNaN(num2)) {
      resp.send("Error: Usage is 'divide [num1] [num2]'");
      return;
    }

    if (num2 === 0) {
      resp.send("Error: Division by zero.");
      return;
    }

    const result = num1 / num2;
    resp.send(result.toString());
  },

  // 12. 數學：次方
  "power": (reqo, resp, data) => {
    const parts = data.trim().split(/\s+/);
    const base = parseFloat(parts[0]);
    const exponent = parseFloat(parts[1]);

    if (isNaN(base) || isNaN(exponent)) {
      resp.send("Error: Usage is 'power [base] [exponent]'");
      return;
    }

    const result = Math.pow(base, exponent);
    resp.send(result.toString());
  },

  // 13. 加密：MD5
  "md5": (reqo, resp, data) => {
    const crypto = require("crypto");
    const hash = crypto.createHash("md5").update(data).digest("hex");
    resp.send(hash);
  },

  // 14. 網路：Ping (利用 execFile 安全執行外部指令)
  "ping": (reqo, resp, data) => {
    const host = data.trim().split(/\s+/)[0];

    if (!host) {
      resp.send("Error: Usage is 'ping [host]'");
      return;
    }

    const { execFile } = require("child_process");
    const isWin = process.platform === "win32";
    const cmd = isWin ? "ping" : "ping";
    const args = isWin ? ["-n", "3", host] : ["-c", "3", host];

    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) {
        resp.send(`Ping Error: ${stderr || stdout || error.message}`);
        return;
      }
      resp.send(stdout);
    });
  },

  // 15. 網路：DNS Lookup (原生 dns 模組，不依賴系統 nslookup，100% 免疫 Command Injection)
  "nslookup": (reqo, resp, data) => {
    const host = data.trim().split(/\s+/)[0];

    if (!host) {
      resp.send("Error: Usage is 'nslookup [host]'");
      return;
    }

    const dns = require("dns");
    dns.resolve(host, (err, addresses) => {
      if (err) {
        resp.send(`DNS Lookup Error: ${err.message}`);
        return;
      }
      resp.send(addresses.join("\n"));
    });
  },

  // 16. 輔助：Textarea 視覺框 (包裝原始資料)
  "textarea": (reqo, resp, data) => {
    if (!data) {
      resp.send("Error: Usage is 'textarea [text]'");
      return;
    }
    const border = "+----------------------------------------------------+";
    const paddedLines = data.split("\n").map((line) => {
      return `| ${line.padEnd(50).slice(0, 50)} |`;
    });
    const output = `${border}\n${paddedLines.join("\n")}\n${border}`;
    resp.send(output);
  }
};

// API Functions END

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "index.html"));
});

app.get("/download", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "download.html"));
});

app.get("/info", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "info.html"));
});

app.get("/download/windows", (req, res) => {
  res.download(path.join(__dirname, "nxlab.exe"));
});

app.get("/download/linux", (req, res) => {
  res.download(path.join(__dirname, "nxlab.sh"));
});

app.get("/download/python", (req, res) => {
  res.download(path.join(__dirname, "nxlab.py"));
});

app.post("/api", (req, res) => {
  if ((Date.now() - lastReq) > 3000) {
    lastReq = Date.now();
    const cmd = req.body.cmd;
    const data = req.body.data;
    if (apifunc[cmd]) {
      apifunc[cmd](req, res, data);
    } else {
      res.status(404).json({"error": "Unknown function."});
    }
  } else {
    res.status(429).json({"error": "Too many requests."});
  }
});

app.all("*", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "404.html"));
});

app.listen(PORT, () => {
  console.log("NXLAB CONSOLE ONLINE!");
});
