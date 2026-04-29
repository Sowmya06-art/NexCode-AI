const express = require("express");
const router = express.Router();
const axios = require("axios");

router.post("/execute", async (req, res) => {
  const { code, language, stdin } = req.body;

  // Direct mapping for OneCompiler
  const langMap = {
    java: "java",
    python: "python",
    javascript: "javascript",
    cpp: "cpp",
    c: "c",
    csharp: "csharp",
  };

  const extMap = {
    java: "java",
    python: "py",
    javascript: "js",
    cpp: "cpp",
    c: "c",
    csharp: "cs",
  };

  const selectedLang = langMap[language.toLowerCase()] || "javascript";
  const fileExtension = extMap[selectedLang] || "txt";

  const data = {
    language: selectedLang,
    stdin: stdin || "",
    files: [
      {
        name: `Main.${fileExtension}`,
        content: code,
      },
    ],
  };
  try {
    const response = await axios.post(
      "https://api.onecompiler.com/v1/run",
      data,
      {
        headers: {
          "X-API-Key": process.env.ONECOMPILER_API_KEY, // Key from image_2eb452.png
          "Content-Type": "application/json",
        },
      },
    );

    // Sending the clean result back to NexCode terminal
    res.json({
      stdout: response.data.stdout || "",
      stderr: response.data.stderr || "",
      compile_output: response.data.exception || "",
      status: "success",
    });
  } catch (error) {
    console.error("OneCompiler Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Execution failed" });
  }
});

module.exports = router;
