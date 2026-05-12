const express = require('express');
const router = express.Router();
const CryptoJS = require('crypto-js');

// ZegoCloud Token Generation Algorithm
function generateToken04(appId, userId, secret, effectiveTimeInSeconds) {
    if (!userId) return '';

    // 1. Construct the payload body
    const time = Math.floor(Date.now() / 1000);
    const body = {
        app_id: appId,
        user_id: userId,
        nonce: Math.floor(Math.random() * 2147483647),
        ctime: time,
        expire: time + (effectiveTimeInSeconds || 3600),
    };

    // 2. Encrypt the payload using AES
    const key = CryptoJS.enc.Utf8.parse(secret);
    let iv = Math.random().toString().substring(2, 18);
    if (iv.length < 16) iv += iv.substring(0, 16 - iv.length);

    const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(body), key, { 
        iv: CryptoJS.enc.Utf8.parse(iv) 
    }).toString();
    
    const ciphertBuffer = Buffer.from(ciphertext, 'base64');

    // 3. Assemble the token data byte-by-byte
    const uint8 = new Uint8Array(28 + ciphertBuffer.length);
    const view = new DataView(uint8.buffer);
    
    view.setUint32(0, 0); // High 32 bits of expiration
    view.setUint32(4, body.expire); // Low 32 bits of expiration
    view.setUint16(8, iv.length); // IV Length
    uint8.set(Buffer.from(iv, 'utf8'), 10); // IV string
    view.setUint16(26, ciphertBuffer.length); // Ciphertext Length
    uint8.set(ciphertBuffer, 28); // Ciphertext

    // 4. Return as a Base64 string with the '04' prefix
    return `04${Buffer.from(uint8).toString('base64')}`;
}

router.get('/get-token', (req, res) => {
    // Make sure these match your backend .env variable names exactly
    const appId = Number(process.env.ZEGO_APP_ID); 
    const serverSecret = process.env.ZEGO_SERVER_SECRET;
    const userId = req.query.userId;
    const roomId = req.query.roomId;

    if (!appId || !serverSecret) {
        return res.status(500).json({ error: "Zego credentials missing in backend .env" });
    }

    if (!roomId || !userId) {
        return res.status(400).json({ error: "Room ID and User ID are required" });
    }

    try {
        // Generate a token valid for 1 hour (3600 seconds)
        const token = generateToken04(appId, userId, serverSecret, 3600);
        res.json({ token, userId });
    } catch (error) {
        console.error("Token Generation Error:", error);
        res.status(500).json({ error: "Failed to generate video token" });
    }
});

module.exports = router;