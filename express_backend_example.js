/**
 * Express.js Backend Server Example
 * -------------------------------------------------------------
 * This file demonstrates how to build a fully functional Express backend 
 * using Mongoose, powered by your MongoDB Atlas connection. It sets up 
 * endpoints for advertisements and accounts to integrate with your Android app.
 *
 * How to Run:
 * 1. Initialize npm in your backend folder: npm init -y
 * 2. Install dependencies: npm install express mongoose cors body-parser
 * 3. Place 'mongoose_connection.js' and this 'express_backend_example.js' in your directory.
 * 4. Run the server: node express_backend_example.js
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { 
    connectDatabase, 
    Advertisement, 
    UserAccount, 
    ActivationCode, 
    AdminUser 
} = require('./mongoose_connection');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so your Android app can communicate with this API
app.use(cors());
app.use(bodyParser.json());

// Initialize MongoDB Atlas connection
connectDatabase();

// ==========================================
// API ENDPOINTS FOR THE ANDROID DASHBOARD
// ==========================================

// Simple Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: "OK", database: "MongoDB Atlas connected successfully!" });
});

// 1. Get All Advertisements
app.get('/api/advertisements', async (req, res) => {
    try {
        const ads = await Advertisement.find({ isActive: true }).sort({ createdAt: -1 });
        res.json(ads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Add New Advertisement from Android
app.post('/api/advertisements', async (req, res) => {
    try {
        const { title, mediaType, mediaUrl, priority, duration } = req.body;
        
        // Calculate dynamic server-side expiry timestamp based on duration
        const now = new Date();
        let expiryAt = new Date();
        if (duration.includes("Day")) expiryAt.setDate(now.getDate() + 1);
        else if (duration.includes("Week")) expiryAt.setDate(now.getDate() + 7);
        else if (duration.includes("Month") || duration.includes("Months")) expiryAt.setMonth(now.getMonth() + 1);
        else if (duration.includes("Year")) expiryAt.setFullYear(now.getFullYear() + 1);
        else expiryAt.setDate(now.getDate() + 30); // Default 1 month

        const newAd = new Advertisement({
            title,
            mediaType,
            mediaUrl,
            priority,
            duration,
            createdAt: now,
            expiryAt,
            isActive: true
        });

        const savedAd = await newAd.save();
        res.status(201).json({ success: true, message: "Campaign published successfully to Atlas CI/CD pipeline", data: savedAd });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. Delete Advertisement
app.delete('/api/advertisements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Advertisement.findByIdAndDelete(id);
        res.json({ success: true, message: "Campaign deleted from cloud storage" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. Generate Activation Code
app.post('/api/activation-codes/generate', async (req, res) => {
    try {
        const { userId, subscriptionType } = req.body;
        
        // Ensure user exists
        const user = await UserAccount.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "Linked user ID not found in Atlas DB" });
        }

        // Generate custom 4 letters + 3 numbers pattern (e.g., ADRE839)
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const numbers = "0123456789";
        let code = "";
        for (let i = 0; i < 4; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
        for (let i = 0; i < 3; i++) code += numbers.charAt(Math.floor(Math.random() * numbers.length));

        const newCode = new ActivationCode({
            code,
            userId,
            subscriptionType,
            isUsed: false
        });

        await newCode.save();
        res.json({ success: true, code: newCode });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 5. Redeem Subscription Code
app.post('/api/activation-codes/redeem', async (req, res) => {
    try {
        const { code, targetUserId } = req.body;
        
        const codeDoc = await ActivationCode.findOne({ code: code.trim().toUpperCase() });
        if (!codeDoc) {
            return res.status(404).json({ error: "Activation code not found." });
        }
        if (codeDoc.isUsed) {
            return res.status(400).json({ error: "This activation code has already been redeemed." });
        }
        if (codeDoc.userId !== targetUserId) {
            return res.status(403).json({ error: "Access Denied: Code is bound to an alternate client account." });
        }

        const user = await UserAccount.findById(targetUserId);
        if (!user) {
            return res.status(404).json({ error: "Target User ID no longer exists in DB." });
        }

        // Calculate subscription expiry date
        const expDate = new Date();
        const type = codeDoc.subscriptionType;
        if (type.includes("Day")) expDate.setDate(expDate.getDate() + 1);
        else if (type.includes("Week")) expDate.setDate(expDate.getDate() + 7);
        else if (type.includes("Month")) expDate.setMonth(expDate.getMonth() + 1);
        else if (type.includes("Year")) expDate.setFullYear(expDate.getFullYear() + 1);

        user.subscriptionType = type;
        user.subscriptionExpiry = expDate;
        user.activatedCode = codeDoc.code;
        await user.save();

        codeDoc.isUsed = true;
        codeDoc.redeemedAt = new Date();
        await codeDoc.save();

        res.json({
            success: true,
            username: user.username,
            subscriptionType: type,
            expiryTime: expDate.getTime()
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Start listening for connections
app.listen(PORT, () => {
    console.log(`📡 Express server is live on http://localhost:${PORT}`);
});
