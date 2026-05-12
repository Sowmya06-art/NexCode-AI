const express = require('express');
const router = express.Router();

router.get('/get-token', (req, res) => {
    const appId = Number(process.env.ZEGO_APP_ID);
    const serverSecret = process.env.ZEGO_SERVER_SECRET;
    const userId = req.query.userId || "user-" + Date.now();
    const roomId = req.query.roomId;

    if (!appId || !serverSecret) {
        return res.status(500).json({ error: "Zego credentials missing in .env" });
    }

    const { generateToken04 } = require('@zegocloud/zego-uikit-prebuilt/core/utils/token_helper');

    try {
        const token = generateToken04(appId, userId, serverSecret, 3600, '');
        res.json({ token, userId });
    } catch (err) {
        console.error("Token error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;