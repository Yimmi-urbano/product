require('dotenv').config();

const { MongoClient, ObjectId } = require('mongodb');

const SOURCE_DB_NAME = 'data-creceidea';
const TARGET_DB_NAME = 'db_creceidea';
const DOMAIN = 'dachi-protein.creceidea.pe';
const VENDOR_SLUG = 'dachi-protein';

function objectId(value) {
    return ObjectId.isValid(value) ? new ObjectId(value) : new ObjectId();
}

function normalizeCategory(sourceCategory, vendorId) {
    const now = new Date();
    const title = sourceCategory.title || sourceCategory.name || sourceCategory.slug || 'Categoria';

    return {
        name: title,
        title,
        slug: sourceCategory.slug,
        description: sourceCategory.description || '',
        image: sourceCategory.icon_url || sourceCategory.image,
        icon_url: sourceCategory.icon_url,
        banner_promotion: sourceCategory.banner_promotion,
        parent: sourceCategory.parent || null,
        productCount: sourceCategory.productCount || 0,
        status: 'active',
        vendorId,
        legacy: {
            source: 'data-creceidea.categories',
            domain: DOMAIN,
            categoryId: sourceCategory._id,
            raw: sourceCategory
        },
        updatedAt: now
    };
}

async function main() {
    if (!process.env.MONGO_URI) throw new Error('Please define MONGO_URI in .env');
    if (!process.env.MONGODB_URI) throw new Error('Please define MONGODB_URI in .env');

    const sourceClient = new MongoClient(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000
    });
    const targetClient = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
    });

    await Promise.all([sourceClient.connect(), targetClient.connect()]);

    const sourceDb = sourceClient.db(SOURCE_DB_NAME);
    const targetDb = targetClient.db(TARGET_DB_NAME);

    const sourceDoc = await sourceDb.collection('categories').findOne({ domain: DOMAIN });
    const categories = Array.isArray(sourceDoc?.categories) ? sourceDoc.categories : [];

    if (categories.length === 0) {
        throw new Error(`No categories found for ${DOMAIN} in ${SOURCE_DB_NAME}.categories`);
    }

    const vendor = await targetDb.collection('vendors').findOne({ slug: VENDOR_SLUG });
    if (!vendor?._id) {
        throw new Error(`Vendor "${VENDOR_SLUG}" was not found in ${TARGET_DB_NAME}.vendors`);
    }

    const operations = categories
        .filter((category) => category.slug)
        .map((category) => {
            const normalized = normalizeCategory(category, vendor._id);
            const categoryId = objectId(category._id);
            return {
                updateOne: {
                    filter: {
                        $or: [
                            { _id: categoryId },
                            { slug: normalized.slug, vendorId: vendor._id }
                        ]
                    },
                    update: {
                        $setOnInsert: {
                            _id: categoryId,
                            createdAt: new Date()
                        },
                        $set: normalized
                    },
                    upsert: true
                }
            };
        });

    const result = operations.length
        ? await targetDb.collection('categories').bulkWrite(operations, { ordered: false })
        : { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };

    const migratedSlugs = categories.map((category) => category.slug).filter(Boolean);

    console.log(JSON.stringify({
        source: `${SOURCE_DB_NAME}.categories`,
        target: `${TARGET_DB_NAME}.categories`,
        domain: DOMAIN,
        vendor: {
            _id: vendor._id,
            slug: vendor.slug,
            storeName: vendor.storeName
        },
        categoriesFound: categories.length,
        categoriesMigrated: migratedSlugs.length,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount,
        slugs: migratedSlugs
    }, null, 2));

    await Promise.all([sourceClient.close(), targetClient.close()]);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
