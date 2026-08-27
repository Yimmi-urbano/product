require('dotenv').config();

const mongoose = require('mongoose');
const slugify = require('slugify');
const {
    getConnection,
    Product,
    Vendor,
    Category
} = require('../api/v2/products/catalog.models');

const OLD_DOMAIN = 'dachi-protein.creceidea.pe';
const VENDOR_SLUG = 'dachi-protein';
const VENDOR_STORE_NAME = 'Dachi Protein';

const oldProductSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const oldVariationSchema = new mongoose.Schema({}, { strict: false, collection: 'variations' });

function titleFromSlug(slug) {
    return String(slug || '')
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function money(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function productPrice(product) {
    const sale = money(product.price?.sale);
    const regular = money(product.price?.regular);
    return sale > 0 ? sale : regular;
}

function comparePrice(product) {
    const sale = money(product.price?.sale);
    const regular = money(product.price?.regular);
    return sale > 0 && regular > sale ? regular : undefined;
}

function normalizeProductType(type) {
    if (!type || type === 'basic' || type === 'simple') return undefined;
    return String(type);
}

function buildMedia(images = []) {
    return images
        .filter(Boolean)
        .map((url, index) => ({
            _id: new mongoose.Types.ObjectId().toString(),
            type: 'image',
            url,
            position: index
        }));
}

function normalizeAttributes(attributes) {
    if (!attributes) return [];
    if (Array.isArray(attributes)) return attributes;
    return Object.entries(attributes).map(([name, value]) => ({
        name,
        value: typeof value === 'string' ? value : value?.value || String(value),
        label: typeof value === 'string' ? value : value?.label
    }));
}

function buildOptions(variations) {
    const optionsByName = new Map();

    for (const variation of variations) {
        for (const attribute of normalizeAttributes(variation.attributes)) {
            const name = attribute.name || 'Opcion';
            if (!optionsByName.has(name)) {
                optionsByName.set(name, {
                    _id: new mongoose.Types.ObjectId().toString(),
                    name,
                    values: new Map(),
                    position: optionsByName.size
                });
            }

            const option = optionsByName.get(name);
            const value = attribute.value || slugify(attribute.label || name, { lower: true, strict: true });
            if (!option.values.has(value)) {
                option.values.set(value, {
                    _id: new mongoose.Types.ObjectId().toString(),
                    value,
                    label: attribute.label,
                    colorCode: attribute.hexa || undefined,
                    position: option.values.size
                });
            }
        }
    }

    return Array.from(optionsByName.values()).map((option) => ({
        _id: option._id,
        name: option.name,
        values: Array.from(option.values.values()).map((value) => ({
            _id: value._id,
            value: value.label || value.value,
            colorCode: value.colorCode,
            position: value.position
        })),
        position: option.position
    }));
}

function buildVariant(variation, options) {
    const attributes = normalizeAttributes(variation.attributes);
    const optionValues = attributes.map((attribute) => {
        const option = options.find((item) => item.name === attribute.name);
        const optionValue = option?.values.find(
            (item) => item.value === attribute.label || item.value === attribute.value
        );

        return {
            optionId: option?._id || new mongoose.Types.ObjectId().toString(),
            optionName: attribute.name,
            valueId: optionValue?._id || new mongoose.Types.ObjectId().toString(),
            value: attribute.label || attribute.value,
            colorCode: attribute.hexa || undefined
        };
    });

    const sale = money(variation.price?.sale);
    const regular = money(variation.price?.regular);
    const price = sale > 0 ? sale : regular;

    return {
        _id: variation._id,
        name: optionValues.map((item) => item.value).filter(Boolean).join(' / ') || variation.sku,
        sku: variation.sku,
        price,
        comparePrice: sale > 0 && regular > sale ? regular : undefined,
        stock: money(variation.stock),
        attributes,
        image: variation.image,
        optionValues,
        inventory: {
            tracked: true,
            quantity: money(variation.stock),
            continueSellingWhenOutOfStock: false
        },
        legacy: {
            source: 'legacy-products-api',
            variationId: variation._id,
            tenantId: OLD_DOMAIN,
            price: variation.price
        }
    };
}

async function ensureVendor() {
    const now = new Date();
    return Vendor().findOneAndUpdate(
        { slug: VENDOR_SLUG },
        {
            $setOnInsert: {
                _id: new mongoose.Types.ObjectId(),
                userId: new mongoose.Types.ObjectId(),
                isDefault: false,
                createdAt: now
            },
            $set: {
                storeName: VENDOR_STORE_NAME,
                slug: VENDOR_SLUG,
                status: 'approved',
                storeActive: true,
                updatedAt: now
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
}

async function ensureCategory(category) {
    const slug = category?.slug || 'general';
    const now = new Date();

    return Category().findOneAndUpdate(
        { slug },
        {
            $setOnInsert: {
                _id: mongoose.isValidObjectId(category?.idcat)
                    ? new mongoose.Types.ObjectId(category.idcat)
                    : new mongoose.Types.ObjectId(),
                createdAt: now
            },
            $set: {
                name: titleFromSlug(slug) || 'General',
                slug,
                status: 'active',
                updatedAt: now
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
}

function buildProductDoc(oldProduct, vendor, category, variations) {
    const images = Array.isArray(oldProduct.image_default) ? oldProduct.image_default.filter(Boolean) : [];
    const media = buildMedia(images);
    const options = buildOptions(variations);
    const variants = variations.map((variation) => buildVariant(variation, options));
    const basePrice = productPrice(oldProduct);
    const variantPrices = variants.map((variant) => variant.price).filter((price) => Number.isFinite(price));
    const minPrice = variantPrices.length ? Math.min(...variantPrices) : basePrice;
    const maxPrice = variantPrices.length ? Math.max(...variantPrices) : basePrice;
    const variantStock = variants.reduce((total, variant) => total + money(variant.stock), 0);
    const stock = variants.length ? variantStock : money(oldProduct.stock);
    const title = oldProduct.title || oldProduct.slug || 'Producto';
    const slug = oldProduct.slug || slugify(title, { lower: true, strict: true });

    return {
        _id: oldProduct._id,
        vendorId: vendor._id,
        productSource: 'admin',
        name: title,
        title,
        slug,
        handle: slug,
        description: oldProduct.description_long || oldProduct.description_short || title,
        shortDescription: oldProduct.description_short || '',
        price: minPrice,
        comparePrice: comparePrice(oldProduct),
        priceRange: { min: minPrice, max: maxPrice },
        stock,
        images,
        media,
        category: category._id,
        productType: normalizeProductType(oldProduct.type_product),
        tags: [],
        attributes: [],
        variants,
        options,
        publishing: {
            onlineStore: oldProduct.is_available !== false,
            pointOfSale: false
        },
        shipping: {
            isPhysicalProduct: true,
            weightUnit: 'kg'
        },
        inventory: {
            tracked: true,
            continueSellingWhenOutOfStock: false
        },
        status: oldProduct.is_available === false ? 'draft' : 'active',
        featured: false,
        rating: 0,
        reviewCount: 0,
        seo: {
            pageTitle: title,
            metaDescription: oldProduct.description_short || '',
            handle: slug
        },
        legacy: {
            source: 'legacy-products-api',
            productId: oldProduct._id,
            tenantId: OLD_DOMAIN,
            domain: OLD_DOMAIN,
            category: oldProduct.category || [],
            order: oldProduct.order || 0,
            order_categorie: oldProduct.order_categorie || [],
            type_product: oldProduct.type_product,
            price: oldProduct.price
        },
        createdAt: oldProduct.createdAt || new Date(),
        updatedAt: new Date()
    };
}

async function main() {
    if (!process.env.MONGO_URI) throw new Error('Please define MONGO_URI in .env');
    if (!process.env.MONGODB_URI) throw new Error('Please define MONGODB_URI in .env');

    const oldConn = await mongoose
        .createConnection(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
        .asPromise();
    const newConn = getConnection();
    await newConn.asPromise();

    const OldProduct = oldConn.model('OldProduct', oldProductSchema);
    const OldVariation = oldConn.model('OldVariation', oldVariationSchema);

    const oldProducts = await OldProduct.find({
        domain: OLD_DOMAIN,
        'is_trash.status': { $ne: true }
    }).sort({ order: 1, createdAt: 1 }).lean();

    const oldProductIds = oldProducts.map((product) => product._id);
    const oldVariations = await OldVariation.find({
        tenantId: OLD_DOMAIN,
        productId: { $in: oldProductIds },
        isTrash: { $ne: true }
    }).lean();

    const variationsByProductId = new Map();
    for (const variation of oldVariations) {
        const key = String(variation.productId);
        if (!variationsByProductId.has(key)) variationsByProductId.set(key, []);
        variationsByProductId.get(key).push(variation);
    }

    const vendor = await ensureVendor();
    const categoryBySlug = new Map();
    let migrated = 0;

    for (const oldProduct of oldProducts) {
        const oldCategory = Array.isArray(oldProduct.category) && oldProduct.category.length
            ? oldProduct.category[0]
            : { slug: 'general' };
        const categorySlug = oldCategory.slug || 'general';

        if (!categoryBySlug.has(categorySlug)) {
            categoryBySlug.set(categorySlug, await ensureCategory(oldCategory));
        }

        const category = categoryBySlug.get(categorySlug);
        const variations = variationsByProductId.get(String(oldProduct._id)) || [];
        const productDoc = buildProductDoc(oldProduct, vendor, category, variations);

        await Product().updateOne(
            { _id: oldProduct._id },
            { $set: productDoc },
            { upsert: true }
        );
        migrated += 1;
    }

    console.log(JSON.stringify({
        domain: OLD_DOMAIN,
        vendor: { _id: vendor._id, slug: vendor.slug, storeName: vendor.storeName },
        productsFound: oldProducts.length,
        variationsFound: oldVariations.length,
        categoriesTouched: categoryBySlug.size,
        productsMigrated: migrated
    }, null, 2));

    await oldConn.close();
    await newConn.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
