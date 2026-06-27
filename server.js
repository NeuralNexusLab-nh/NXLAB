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
  "help": (reqo, resp, data) => {
    resp.send("Info page: https://nxlab.nett.to/info");
  },
  
  "ip": (reqo, resp, data) => {
    const clientIp = reqo.ip;
    resp.send(clientIp);
  },

  "echo": (reqo, resp, data) => {
    resp.send(data);
  },

  "base64ec": (reqo, resp, data) => {
    const encoded = Buffer.from(data).toString("base64");
    resp.send(encoded);
  },

  "base64dc": (reqo, resp, data) => {
    const decoded = Buffer.from(data, "base64").toString("utf-8");
    resp.send(decoded);
  },

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

  "tcp": (reqo, resp, data) => {
    const parts = data.trim().split(/\s+/);
    const host = parts[0];
    const port = parseInt(parts[1], 10);

    if (!host || isNaN(port)) {
      resp.send("Error: Usage is 'tcp [host] [port]'");
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

  "udp": (reqo, resp, data) => {
    const parts = data.trim().split(/\s+/);
    const host = parts[0];
    const port = parseInt(parts[1], 10);
    const message = parts.slice(2).join(" ") || "NXLAB UDP Payload";

    if (!host || isNaN(port)) {
      resp.send("Error: Usage is 'udp [host] [port] [message]'");
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

  "md5": (reqo, resp, data) => {
    const crypto = require("crypto");
    const hash = crypto.createHash("md5").update(data).digest("hex");
    resp.send(hash);
  },

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
  },

  "jwt": (reqo, resp, data) => {
    const parts = data.trim().split(".");
    if (parts.length !== 3) {
      resp.send("Error: Invalid JWT token format.");
      return;
    }
    try {
      const header = Buffer.from(parts[0], "base64").toString("utf-8");
      const payload = Buffer.from(parts[1], "base64").toString("utf-8");
      const formattedHeader = JSON.stringify(JSON.parse(header), null, 2);
      const formattedPayload = JSON.stringify(JSON.parse(payload), null, 2);
      resp.send(`[Header]\n${formattedHeader}\n\n[Payload]\n${formattedPayload}`);
    } catch (err) {
      resp.send(`JWT Decode Error: ${err.message}`);
    }
  },

  "passwd": (reqo, resp, data) => {
    const len = parseInt(data.trim(), 10) || 16;
    if (len < 4 || len > 1024) {
      resp.send("Error: Password length must be between 4 and 1024.");
      return;
    }
    const crypto = require("crypto");
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let password = "";
    const bytes = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) {
      password += chars[bytes[i] % chars.length];
    }
    resp.send(password);
  },

  "hexec": (reqo, resp, data) => {
    const hex = Buffer.from(data).toString("hex");
    resp.send(hex);
  },

  "hexdc": (reqo, resp, data) => {
    try {
      const decoded = Buffer.from(data, "hex").toString("utf-8");
      resp.send(decoded);
    } catch (err) {
      resp.send(`Hex Decode Error: ${err.message}`);
    }
  },

  "ipinfo": (reqo, resp, data) => {
    const ip = data.trim();
    fetch(`http://ip-api.com/json/${ip}`)
      .then((res) => {
        return res.json();
      })
      .then((json) => {
        if (json.status === "fail") {
          resp.send(`IP Info Error: ${json.message}`);
          return;
        }
        const output = `[IP] ${json.query}\n[Country] ${json.country} (${json.countryCode})\n[Region] ${json.regionName}\n[City] ${json.city}\n[ISP] ${json.isp}\n[ASN] ${json.as}`;
        resp.send(output);
      })
      .catch((err) => {
        resp.send(`IP Info Connection Failed: ${err.message}`);
      });
  },

  "wttr": (reqo, resp, data) => {
    const city = data.trim();
    if (city) {
      resp.send("Error: Invalid location format.");
      return;
    }
    fetch(`https://wttr.in/${city}?An`)
      .then((res) => {
        return res.text();
      })
      .then((text) => {
        resp.send(text);
      })
      .catch((err) => {
        resp.send(`Weather Lookup Failed: ${err.message}`);
      });
  }
};

// API Functions END

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "index.html"));
});

app.get("/devtools.js", (req, res) => {
  res.sendFile(path.join(__dirname, "devtools.js"));
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
