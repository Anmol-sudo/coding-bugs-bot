import express from 'express';
import axios from 'axios';
import 'dotenv/config'; // Make sure to install this: npm install dotenv

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

const PORT = process.env.PORT || 3000;
const WP_VERIFY_TOKEN = process.env.WP_VERIFY_TOKEN; // A secret token you create
const WP_ACCESS_TOKEN = process.env.WP_BUSINESS_ACCESS_TOKEN;
const WP_PHONE_NUMBER_ID = process.env.WP_PHONE_NUMBER_ID; // Get this from your Meta App Dashboard

// JDoodle API credentials
const JDOODLE_CLIENT_ID = process.env.JDOODLE_CLIENT_ID;
const JDOODLE_CLIENT_SECRET = process.env.JDOODLE_CLIENT_SECRET;

// Function to execute C++ code
async function runCpp(code) {
  try {
    const response = await axios.post("https://api.jdoodle.com/v1/execute", {
      script: code,
      language: "cpp17",
      versionIndex: "0",
      clientId: JDOODLE_CLIENT_ID,
      clientSecret: JDOODLE_CLIENT_SECRET,
    });
    return response.data.output || "No output.";
  } catch (error) {
    console.error("JDoodle API Error:", error.response ? error.response.data : error.message);
    return `⚠️ Error executing code: ${error.message}`;
  }
}

// Function to send a WhatsApp message
async function sendWhatsAppMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${WP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${WP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error sending WhatsApp message:", error.response ? error.response.data : error.message);
  }
}

// ---- Webhook Endpoints ----

// 1. Webhook Verification Endpoint (for setup in Meta Dashboard)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === WP_VERIFY_TOKEN) {
    console.log("Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 2. Receiving Messages Endpoint
app.post("/webhook", async (req, res) => {
  const entry = req.body.entry?.[0];
  const change = entry?.changes?.[0];
  const messageData = change?.value?.messages?.[0];

  // Check if it's a valid text message
  if (messageData && messageData.type === 'text') {
    const from = messageData.from; // Sender's phone number
    const text = messageData.text.body;
    const lowerText = text.toLowerCase();

    let replyText = "";

    if (lowerText === "hi") {
      replyText = "Hi, this is your friendly coding bot! 👋 To execute code, use:\n\n`!run cpp <code>`";
    }else if (lowerText === "Ashmeet ke bare mai kuch batao?") {
      replyText = "Ye banda, Anmol ke har interest ko ek ladki se connect karta hai`"; 
    }
    else if (lowerText === "Chaitanya ke bare mai batao") {
      replyText = "Ye banda, Anmol ke saath baith ta hai class mai";
    } else if (lowerText.startsWith("!run cpp")) {
      const code = text.replace(/!run cpp/i, "").trim();
      const output = await runCpp(code);
      replyText = "🖥️ **Output:**\n```\n" + output + "\n```";
    }

    if (replyText) {
      await sendWhatsAppMessage(from, replyText);
    }
  }

  res.sendStatus(200); // Always respond with 200 OK
});


app.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
});