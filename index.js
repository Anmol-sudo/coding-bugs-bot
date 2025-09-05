import makeWASocket, { useMultiFileAuthState } from "baileys";
import qrcode from "qrcode-terminal";
import express from "express";
import * as qrImage from "qrcode";

const app = express();
const PORT = process.env.PORT || 3000;

let sock;
let latestQR = null; // store QR here

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  sock = makeWASocket({ auth: state });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr; // save QR
      console.log("Scan this QR to log in:");
      qrcode.generate(qr, { small: true }); // still show ASCII QR in logs
    }

    if (connection === "open") {
      console.log("✅ Connected to WhatsApp!");
    } else if (connection === "close") {
      console.log("❌ Connection closed. Reconnecting...");
      connectToWhatsApp();
    }
  });

  sock.ev.on("creds.update", saveCreds);
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
