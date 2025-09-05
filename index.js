import makeWASocket, { useMultiFileAuthState } from "baileys";
import qrcode from "qrcode-terminal";
import express from "express";
import * as qrImage from "qrcode";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

let sock; // only one socket
let latestQR = null;

// Function to execute C++ code with JDoodle API
async function runCpp(code) {
  try {
    const res = await axios.post("https://api.jdoodle.com/v1/execute", {
      script: code,
      language: "cpp17",
      versionIndex: "0",
      clientId: process.env.JDOODLE_CLIENT_ID,
      clientSecret: process.env.JDOODLE_CLIENT_SECRET,
    });
    return res.data.output;
  } catch (err) {
    return "⚠️ Error executing code: " + err.message;
  }
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  sock = makeWASocket({ auth: state });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log("Scan this QR to log in:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ Connected to WhatsApp!");
    } else if (connection === "close") {
      console.log("❌ Connection closed. Reconnecting...");
      connectToWhatsApp();
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // --- Listen for messages ---
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;
    if (!text) return;

    const lowerText = text.toLowerCase();

    if (lowerText === "hi") {
      await sock.sendMessage(msg.key.remoteJid, { text: "Hi, this is me your friendly coding bot! To execute code, use !run cpp <code>" });
    }

    if (lowerText.startsWith("!run cpp")) {
      const code = text.replace(/!run cpp/i, "").trim();
      const output = await runCpp(code);
      await sock.sendMessage(msg.key.remoteJid, { text: "🖥️ Output:\n" + output });
    }
  });
}

// --- Express route to fetch QR as image ---
app.get("/qr", async (req, res) => {
  if (!latestQR) {
    return res.send("QR not generated yet, please wait...");
  }
  try {
    const qrPng = await qrImage.toBuffer(latestQR, { type: "png" });
    res.type("png");
    res.send(qrPng);
  } catch (err) {
    res.status(500).send("Error generating QR");
  }
});

// --- Example API route to send message ---
app.get("/send", async (req, res) => {
  const jid = req.query.jid; // phone number like "91XXXXXXXXXX@s.whatsapp.net"
  const msg = req.query.msg || "Hello from Render!";
  try {
    await sock.sendMessage(jid, { text: msg });
    res.send("Message sent!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to send message");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  connectToWhatsApp();
});
