const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { 
    connectDatabase, 
    Advertisement, 
    UserAccount, 
    ActivationCode 
} = require('./mongoose_connection');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// تشغيل الاتصال بـ MongoDB Atlas
connectDatabase();

// 1. فحص تشغيل الخادم
app.get('/api/health', (req, res) => {
    res.json({ status: "OK", database: "Connected successfully to MongoDB Atlas!" });
});

// 2. جلب كافة الإعلانات (يستخدمه كلا التطبيقين لعرض الإعلانات النشطة)
app.get('/api/advertisements', async (req, res) => {
    try {
        const ads = await Advertisement.find({ isActive: true }).sort({ createdAt: -1 });
        res.json(ads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. إضافة إعلان جديد (تستخدمه لوحة التحكم)
app.post('/api/advertisements', async (req, res) => {
    try {
        const { title, mediaType, mediaUrl, priority, duration } = req.body;
        
        const now = new Date();
        let expiryAt = new Date();
        if (duration.includes("Day")) expiryAt.setDate(now.getDate() + 1);
        else if (duration.includes("Week")) expiryAt.setDate(now.getDate() + 7);
        else if (duration.includes("Month")) expiryAt.setMonth(now.getMonth() + 1);
        else if (duration.includes("Year")) expiryAt.setFullYear(now.getFullYear() + 1);
        else expiryAt.setDate(now.getDate() + 30);

        const newAd = new Advertisement({
            title, mediaType, mediaUrl, priority, duration, createdAt: now, expiryAt, isActive: true
        });

        const savedAd = await newAd.save();
        res.status(201).json({ success: true, data: savedAd });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. حذف إعلان (تستخدمه لوحة التحكم)
app.delete('/api/advertisements/:id', async (req, res) => {
    try {
        await Advertisement.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Campaign deleted successfully" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 5. توليد كود تفعيل (تستخدمه لوحة التحكم)
app.post('/api/activation-codes/generate', async (req, res) => {
    try {
        const { userId, subscriptionType } = req.body;
        
        // التأكد أولاً من وجود حساب العميل أو إنشائه تلقائياً إذا كان جديداً
        let user = await UserAccount.findById(userId);
        if (!user) {
            user = new UserAccount({ _id: userId, username: `Client-${userId.split('-')[1] || userId}`, subscriptionType: 'None' });
            await user.save();
        }

        // توليد كود عشوائي فريد (مثل: ACME382)
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const numbers = "0123456789";
        let code = "";
        for (let i = 0; i < 4; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
        for (let i = 0; i < 3; i++) code += numbers.charAt(Math.floor(Math.random() * numbers.length));

        const newCode = new ActivationCode({
            code, userId, subscriptionType, isUsed: false
        });

        await newCode.save();
        res.json({ success: true, code: newCode });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 6. استرداد وتفعيل كود الاشتراك (يستخدمه التطبيق الآخر للمشتركين)
app.post('/api/activation-codes/redeem', async (req, res) => {
    try {
        const { code, targetUserId } = req.body;
        
        const codeDoc = await ActivationCode.findOne({ code: code.trim().toUpperCase() });
        if (!codeDoc) {
            return res.status(404).json({ error: "Code not found." });
        }
        if (codeDoc.isUsed) {
            return res.status(400).json({ error: "Code already redeemed." });
        }
        if (codeDoc.userId !== targetUserId) {
            return res.status(403).json({ error: "Access Denied: Code belongs to someone else." });
        }

        const user = await UserAccount.findById(targetUserId);
        if (!user) return res.status(404).json({ error: "User not found." });

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

app.listen(PORT, () => {
    console.log(`📡 Server running on http://localhost:${PORT}`);
});
