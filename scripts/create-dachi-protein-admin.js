require('dotenv').config();

const crypto = require('crypto');
const { pathToFileURL } = require('url');
const mongoose = require('mongoose');
const {
    getConnection,
    Vendor
} = require('../api/v2/products/catalog.models');

const ADMIN_EMAIL = 'admin@dachi-protein.creceidea.pe';
const ADMIN_NAME = 'Administrador Dachi Protein';
const VENDOR_SLUG = 'dachi-protein';
const BETTER_AUTH_PASSWORD_PATH =
    'D:/Desarrollo Agencsi/CreceIdea Project SaaS/Storify-app/node_modules/better-auth/dist/crypto/password.mjs';

function createTemporaryPassword() {
    return `Dachi-${crypto.randomBytes(12).toString('base64url')}!9`;
}

async function hashPassword(password) {
    const passwordModule = await import(pathToFileURL(BETTER_AUTH_PASSWORD_PATH).href);
    return passwordModule.hashPassword(password);
}

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('Please define MONGODB_URI in .env');

    const conn = getConnection();
    await conn.asPromise();

    const db = conn.db;
    const now = new Date();
    const temporaryPassword = createTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const userCollection = db.collection('user');
    const accountCollection = db.collection('account');

    let user = await userCollection.findOne({ email: ADMIN_EMAIL });
    let createdUser = false;

    if (!user) {
        const userId = new mongoose.Types.ObjectId();
        user = {
            _id: userId,
            name: ADMIN_NAME,
            email: ADMIN_EMAIL,
            emailVerified: true,
            emailVerifiedAt: now,
            role: 'vendor',
            roles: ['vendor'],
            status: 'active',
            addresses: [],
            twoFactorEnabled: false,
            emailVerificationAudience: 'vendor',
            createdAt: now,
            updatedAt: now
        };
        await userCollection.insertOne(user);
        createdUser = true;
    } else {
        await userCollection.updateOne(
            { _id: user._id },
            {
                $set: {
                    name: user.name || ADMIN_NAME,
                    role: 'vendor',
                    roles: ['vendor'],
                    status: 'active',
                    emailVerified: true,
                    emailVerifiedAt: user.emailVerifiedAt || now,
                    emailVerificationAudience: 'vendor',
                    updatedAt: now
                }
            }
        );
    }

    const existingAccount = await accountCollection.findOne({
        userId: user._id,
        providerId: 'credential'
    });

    if (!existingAccount) {
        await accountCollection.insertOne({
            _id: new mongoose.Types.ObjectId(),
            accountId: String(user._id),
            providerId: 'credential',
            userId: user._id,
            password: passwordHash,
            createdAt: now,
            updatedAt: now
        });
    }

    const vendor = await Vendor().findOneAndUpdate(
        { slug: VENDOR_SLUG },
        {
            $set: {
                userId: user._id,
                status: 'approved',
                storeActive: true,
                updatedAt: now
            }
        },
        { new: true }
    ).lean();

    if (!vendor) {
        throw new Error(`Vendor "${VENDOR_SLUG}" was not found.`);
    }

    console.log(JSON.stringify({
        email: ADMIN_EMAIL,
        temporaryPassword: existingAccount ? null : temporaryPassword,
        passwordCreated: !existingAccount,
        userCreated: createdUser,
        userId: String(user._id),
        role: 'vendor',
        vendor: {
            _id: vendor._id,
            slug: vendor.slug,
            storeName: vendor.storeName,
            userId: vendor.userId
        }
    }, null, 2));

    await conn.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
