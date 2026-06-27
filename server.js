const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());
app.set("trust proxy", true);

const PORT = process.env.PORT || 10000;

// Middleware
// UNDEVELOPED ID6

// API Functions
const apifunc = {
  "ip": (reqo, resp, data) => {resp.send(reqo.ip)},
  "echo": (reqo, resp, data) => {resp.send(data)}
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "index.html"));
  // UNDEVELOPED ID1
});

app.get("/download", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "download.html"));
  // UNDEVELOPED ID2
});

app.get("/download/windows", (req, res) => {
  res.download(path.join(__dirname, "files", "nxlab.exe"));
  // UNDEVELOPED ID3
});

app.get("/download/linux", (req, res) => {
  res.download(path.join(__dirname, "files", "nxlab.sh"));
  // UNDEVELOPED ID4
});

app.get("/download/python", (req, res) => {
  res.download(path.join(__dirname, "files", "nxlab.py"));
  // UNDEVELOPED ID5
});

app.post("/api", (req, res) => {
  const cmd = req.body.cmd;
  const data = req.body.data;
  if (apifunc[cmd]) {
    apifunc[cmd](req, res, data);
  } else {
    res.status(404).json({"error": "Unknown function."});
  }
});

app.all("*", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "404.html"));
  // UNDEVELOPED ID7
});

app.listen(PORT, () => {
  console.log("NXLAB CONSOLE ONLINE!");
});
