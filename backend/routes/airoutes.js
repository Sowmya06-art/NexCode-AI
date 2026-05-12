// airoutes.js

const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config(); // This loads your .env file

// Use the key from your environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/explain', async (req, res) => {
    const { code, language } = req.body;
    
    if (!code) return res.status(400).json({ error: "No code provided" });

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `You are a professional coding instructor. 
        Explain this ${language || 'code'} simply and highlight any potential bugs:
        \n\n ${code}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        res.json({ explanation: response.text() });
    } catch (error) {
        console.error("Gemini Error:", error.message);
        
        // If the key fails again, this will tell you why in the console
        res.status(500).json({ explanation: "AI Assistant is currently offline. Check API key status." });
    }
});

module.exports = router;