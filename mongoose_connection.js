const mongoose = require('mongoose');
require('dotenv').config();

// قراءة رابط الاتصال بشكل آمن من ملف .env
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin:N1a5nZ8IhU4BJ2c7@cluster0.odxgej5.mongodb.net/RedLineDB?retryWrites=true&w=majority&appName=Cluster0";

const connectDatabase = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("🚀 Connected successfully to MongoDB Atlas: RedLineDB");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error.message);
        process.exit(1);
    }
};

// 1. حسابات المشرفين (Admin Users)
const AdminUserSchema = new mongoose.Schema({
    userId: { type: Number, default: 1, unique: true },
    username: { type: String, required: true },
    passwordHash: { type: String, required: true },
    lastLogin: { type: Date, default: Date.now }
}, { timestamps: true });

const AdminUser = mongoose.model('AdminUser', AdminUserSchema);

// 2. الإعلانات والاتفاقيات (Advertisements)
const AdvertisementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    mediaType: { type: String, enum: ['IMAGE', 'VIDEO'], required: true },
    mediaUrl: { type: String, required: true },
    priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], required: true },
    duration: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiryAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Advertisement = mongoose.model('Advertisement', AdvertisementSchema);

// 3. حسابات العملاء المشتركين (User Accounts)
const UserAccountSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // USR-7302 مثلاً
    username: { type: String, required: true },
    subscriptionType: { type: String, enum: ['None', 'Day', 'Week', 'Month', 'Year'], default: 'None' },
    subscriptionExpiry: { type: Date, default: null },
    activatedCode: { type: String, default: null }
}, { timestamps: true });

const UserAccount = mongoose.model('UserAccount', UserAccountSchema);

// 4. رموز التفعيل والاشتراكات (Activation Codes)
const ActivationCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    userId: { type: String, ref: 'UserAccount', required: true },
    subscriptionType: { type: String, enum: ['Day', 'Week', 'Month', 'Year'], required: true },
    isUsed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    redeemedAt: { type: Date, default: null }
}, { timestamps: true });

const ActivationCode = mongoose.model('ActivationCode', ActivationCodeSchema);

module.exports = {
    connectDatabase,
    AdminUser,
    Advertisement,
    UserAccount,
    ActivationCode,
    mongoose
};
