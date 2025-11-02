// GEMINI AI RAG IMPLEMENTATION GUIDE
// ===================================
// This file shows how to use Google Gemini API for RAG question generation

// STEP 1: Get Your Gemini API Key
// ================================
/*
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key
5. Paste it in script.js where it says 'YOUR_GEMINI_API_KEY_HERE'
*/

// STEP 2: Configuration (Already in script.js)
// =============================================
/*
const GEMINI_API_KEY = 'YOUR_ACTUAL_API_KEY_HERE';

// Or create a separate config.js file:
const config = {
    GEMINI_API_KEY: 'your-api-key-here',
    MODEL: 'gemini-1.5-flash', // or 'gemini-1.5-pro' for better quality
    TEMPERATURE: 0.7
};
*/

// STEP 3: The Main Implementation (Already Added!)
// =================================================
// The generateQuestions() function in script.js now uses Gemini API!

// Current Implementation Overview:
async function generateQuestionsWithGemini(text, numQuestions) {
    const prompt = `Generate ${numQuestions} multiple-choice questions from this text...`;
    
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048
                }
            })
        }
    );
    
    const data = await response.json();
    const generatedText = data.candidates[0].content.parts[0].text;
    const questions = JSON.parse(generatedText);
    
    return questions;
}

// STEP 4: Advanced Gemini Features
// =================================

// Use Gemini Pro for Better Quality
async function generateQuestionsGeminiPro(text, numQuestions) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `Generate ${numQuestions} questions from: ${text}` }]
                }],
                generationConfig: {
                    temperature: 0.9,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            })
        }
    );
    
    const data = await response.json();
    return parseGeminiResponse(data);
}

// Parse Gemini Response
function parseGeminiResponse(data) {
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
        throw new Error('No response from Gemini');
    }
    
    // Remove markdown code blocks if present
    let jsonText = generatedText.trim();
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    return JSON.parse(jsonText);
}

// STEP 5: Error Handling
// =======================

async function generateQuestionsWithErrorHandling(text, numQuestions) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `Generate ${numQuestions} questions...` }] }]
                })
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            
            // Handle specific error cases
            if (response.status === 400) {
                throw new Error('Invalid request. Check your prompt format.');
            } else if (response.status === 403) {
                throw new Error('API key invalid or quota exceeded.');
            } else if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait and try again.');
            } else {
                throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
            }
        }
        
        const data = await response.json();
        return parseGeminiResponse(data);
        
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw error;
    }
}

// STEP 6: Safety Settings (Optional)
// ===================================

async function generateQuestionsWithSafety(text, numQuestions) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `Generate ${numQuestions} questions from: ${text}` }]
                }],
                safetySettings: [
                    {
                        category: 'HARM_CATEGORY_HATE_SPEECH',
                        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                    },
                    {
                        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048
                }
            })
        }
    );
    
    return await response.json();
}

// GEMINI API FEATURES & BENEFITS
// ===============================

/*
✅ FREE TIER AVAILABLE
- 15 requests per minute
- 1 million tokens per minute
- 1,500 requests per day

✅ MODELS AVAILABLE
- gemini-1.5-flash (Fast, efficient)
- gemini-1.5-pro (Better quality)
- gemini-1.0-pro (Legacy)

✅ PRICING (if you exceed free tier)
- Flash: $0.075 per 1M input tokens
- Pro: $1.25 per 1M input tokens
- Much cheaper than OpenAI!

✅ FEATURES
- No credit card required for free tier
- 1 million token context window
- JSON mode support
- Multimodal (text + images)
- Fast response times
*/

// COST ESTIMATION FOR GEMINI
// ===========================
/*
Average document (5,000 words ≈ 6,500 tokens):
- Input: 6,500 tokens
- Output: ~1,500 tokens (for 10 questions)
- Total: 8,000 tokens

With Gemini Flash (FREE tier):
- Cost: $0.00 (within free limits)
- Speed: ~2-3 seconds

With Gemini Pro (if needed):
- Input: 6,500 tokens × $1.25/1M = $0.008
- Output: 1,500 tokens × $5.00/1M = $0.0075
- Total per document: ~$0.015 (1.5 cents)

MUCH cheaper than OpenAI GPT-4!
*/

// QUICK SETUP GUIDE
// =================
/*
1. Get API Key:
   - Visit: https://makersuite.google.com/app/apikey
   - Sign in with Google
   - Click "Create API Key"
   - Copy the key

2. Add to script.js:
   - Open script.js
   - Find: const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
   - Replace with: const GEMINI_API_KEY = 'your-actual-key-here';

3. Test it:
   - Open index.html
   - Click RAG Generator
   - Upload sample_document.txt
   - Generate questions
   - Should now use AI!

4. Verify AI is working:
   - Check browser console (F12)
   - Should NOT see "Using fallback algorithm"
   - Questions should be higher quality
*/

// TROUBLESHOOTING
// ===============

// Error: "API key not valid"
// Solution: Check your API key is correct and active

// Error: "Quota exceeded"
// Solution: Wait for quota to reset (1 minute for RPM, 1 day for RPD)

// Error: "Failed to parse JSON"
// Solution: The model returned invalid JSON. Try:
// 1. Simplify the prompt
// 2. Add "Return ONLY valid JSON" to prompt
// 3. Use gemini-1.5-pro instead of flash

// Error: "Network error"
// Solution: Check internet connection and firewall

// TESTING YOUR GEMINI SETUP
// ==========================

async function testGeminiAPI() {
    const testKey = 'YOUR_API_KEY_HERE'; // Replace with your key
    
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${testKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'Say hello!' }]
                    }]
                })
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Gemini API is working!');
            console.log('Response:', data.candidates[0].content.parts[0].text);
            return true;
        } else {
            const error = await response.json();
            console.error('❌ Gemini API error:', error);
            return false;
        }
    } catch (error) {
        console.error('❌ Network error:', error);
        return false;
    }
}

// Run this in browser console to test:
// testGeminiAPI()

// ADVANCED: Streaming Responses (Optional)
// =========================================

async function generateQuestionsStreaming(text, numQuestions) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `Generate ${numQuestions} questions from: ${text}` }]
                }]
            })
        }
    );
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        result += decoder.decode(value, { stream: true });
        // Update UI with partial results here
    }
    
    return JSON.parse(result);
}

// BEST PRACTICES
// ==============
/*
1. Rate Limiting:
   - Track request count
   - Implement retry logic
   - Cache results when possible

2. Error Handling:
   - Always have fallback
   - Log errors for debugging
   - Show user-friendly messages

3. Security:
   - Never expose API key in frontend (for production)
   - Use environment variables
   - Implement backend proxy for production

4. Optimization:
   - Truncate very long documents
   - Batch multiple requests if needed
   - Use Flash model for speed, Pro for quality

5. User Experience:
   - Show loading indicators
   - Display progress
   - Allow cancellation
*/

// PRODUCTION DEPLOYMENT
// =====================
/*
For production, move API key to backend:

Backend (Node.js example):
```javascript
const express = require('express');
const app = express();

app.post('/api/generate-questions', async (req, res) => {
    const { text, numQuestions } = req.body;
    
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate ${numQuestions} questions...` }] }]
            })
        }
    );
    
    const data = await response.json();
    res.json(data);
});
```

Frontend (update script.js):
```javascript
async function generateQuestions(text, numQuestions) {
    const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, numQuestions })
    });
    
    return await response.json();
}
```
*/

// COMPARISON: Gemini vs OpenAI
// =============================
/*
GEMINI ADVANTAGES:
✅ FREE tier (generous limits)
✅ Much cheaper when paid
✅ 1M token context window
✅ No credit card for free tier
✅ Fast response times
✅ Good quality for educational content

OPENAI ADVANTAGES:
✅ Slightly better quality (GPT-4)
✅ More established ecosystem
✅ Better for complex reasoning
✅ Function calling support

RECOMMENDATION:
- Use Gemini for this project (perfect for education)
- Free tier is more than enough
- Upgrade to Pro only if you need better quality
*/
