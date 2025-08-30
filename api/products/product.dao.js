const Product = require('./product.model');
const Variation = require('../variations/variations.model');
const Attribute = require('../attributes/attribute.model');

const Promotion = require('../../models/promotions.model');

async function applyPromotionsToProducts(domain, productsInput) {
    const products = Array.isArray(productsInput) ? productsInput : [productsInput];
    if (!products || products.length === 0) return productsInput;

    const now = new Date();
    const categorySlugs = new Set();

    products.forEach(product => {
        if (product?.category && Array.isArray(product.category)) {
            product.category.forEach(cat => {
                if (cat?.slug) categorySlugs.add(cat.slug);
            });
        }
    });

    if (categorySlugs.size === 0) return productsInput;

    const activePromotions = await Promotion.find({
        tenantId: domain,
        categories: { $in: Array.from(categorySlugs) },
        isActive: true,
        startDate: { $lte: now },
        expirationDate: { $gte: now }
    }).lean();

    if (activePromotions.length === 0) return productsInput;

    const promotionsByCatSlug = {};
    activePromotions.forEach(promo => {
        promo.categories.forEach(slug => {
            if (!promotionsByCatSlug[slug]) {
                promotionsByCatSlug[slug] = [];
            }
            promotionsByCatSlug[slug].push(promo);
        });
    });

    for (const product of products) {
        if (!product) continue;

        const productCategorySlugs = (product.category || []).map(cat => cat.slug).filter(Boolean);

        let bestPromo = null;
        let bestCalculatedPrice = Infinity;

        productCategorySlugs.forEach(slug => {
            if (promotionsByCatSlug[slug]) {
                promotionsByCatSlug[slug].forEach(promo => {
                    const referencePrice = 100;
                    let calculatedPrice = referencePrice;

                    if (promo.discountType === 'percentage') {
                        calculatedPrice = referencePrice * (1 - (promo.discountValue / 100));
                    } else if (promo.discountType === 'fixed') {
                        calculatedPrice = referencePrice - promo.discountValue;
                    }

                    if (calculatedPrice < bestCalculatedPrice) {
                        bestCalculatedPrice = calculatedPrice;
                        bestPromo = promo;
                    }
                });
            }
        });

        const applyPromoToPrice = (priceObj, promo) => {
            if (!priceObj?.regular) return false;

            const existingSale = priceObj.sale;
            const hasValidSale = existingSale > 0 && existingSale < priceObj.regular;

            if (hasValidSale || !promo) return false;

            let salePrice = promo.discountType === 'percentage'
                ? priceObj.regular * (1 - promo.discountValue / 100)
                : priceObj.regular - promo.discountValue;

            salePrice = Math.max(0, salePrice);

            const currentSaleNotUseful = !existingSale || existingSale <= 0 || existingSale >= priceObj.regular;

            if (salePrice < priceObj.regular && (currentSaleNotUseful || salePrice < existingSale)) {
                priceObj.sale = parseFloat(salePrice.toFixed(2));
                priceObj.tag = promo.name;
                return true;
            }

            return false;
        };

        if (product.price && bestPromo) {
            applyPromoToPrice(product.price, bestPromo);
        }

        const dbVariations = await Variation.find({
            tenantId: domain,
            productId: product._id,
            isTrash: false,
            isAvailable: true
        }).lean();

        const enrichedVariations = dbVariations.map(variation => {
            if (variation.price && bestPromo) {
                applyPromoToPrice(variation.price, bestPromo);
            }
            return variation;
        });

        product.variations = enrichedVariations;
    }

    return Array.isArray(productsInput) ? products : products[0];
}

const findByDomainAndSlug = (domain, slug) =>
    Product.findOne({ domain, slug });

async function getProductBySlugs(domain, slug) {

    const product = await Product.findOne({
        domain,
        slug,
        'is_trash.status': false
    });

    if (!product) return null;

    const { tenantId, _id: productId } = product;

    const variations = await Variation.find({
        tenantId: domain,
        productId,
        isTrash: false,
        isAvailable: true
    });

    const attributes = await Attribute.find({ tenantId: domain });

    return {
        ...product.toObject(),
        variations,
        attributes
    };
}

const findById = (domain, id) =>
    Product.findOne({ domain, _id: id, 'is_trash.status': false });


const findAll = async (domain, skip, limit) => {
    const products = await Product.find({ domain, 'is_trash.status': false })
        .sort({ order: 1 }) // 👈 Ordena por "order" ascendente
        .skip(skip)
        .limit(limit)
        .select('_id stock is_available image_default title price description_short slug order order_categorie')
        .lean();

    return products.map((product, index) => ({
        ...product,
        // Si no tiene "order", asigna un valor incremental relativo al skip
        order: product.order ?? skip + ++index,
    }));
};

const countAll = (domain) =>
    Product.countDocuments({ domain, 'is_trash.status': false });

const findByCategorySlug = (domain, slug, skip, limit) =>
    Product.find({ domain, 'category.slug': slug, 'is_trash.status': false })
        .skip(skip)
        .limit(limit);

const countByCategorySlug = (domain, slug) =>
    Product.countDocuments({ domain, 'category.slug': slug, 'is_trash.status': false });

const searchByTitle = (domain, query, skip, limit) =>
    Product.find({ domain, title: { $regex: query, $options: 'i' }, 'is_trash.status': false })
        .skip(skip)
        .limit(limit)
        .select('_id stock is_available image_default title price description_short slug');

const countByTitle = (domain, query) =>
    Product.countDocuments({ domain, title: { $regex: query, $options: 'i' }, 'is_trash.status': false });

const updateProductsOrder = async (updates) => {
    const bulkOps = updates.map(item => ({
        updateOne: {
            filter: { _id: item.id_product },
            update: { $set: { order: item.order } }
        }
    }));

    return Product.bulkWrite(bulkOps);
};

const updateProductsOrderByCategory = async (updates, name_category) => {
    const bulkOps = updates.map(item => ({
        updateOne: {
            filter: { _id: item.id_product, "order_categorie.categorie": name_category },
            update: { $set: { "order_categorie.$.order": item.order } }
        }
    }));

    const addIfNotExists = updates.map(item => ({
        updateOne: {
            filter: { _id: item.id_product, "order_categorie.categorie": { $ne: name_category } },
            update: {
                $push: { order_categorie: { categorie: name_category, order: item.order } }
            }
        }
    }));

    return await Product.bulkWrite([...bulkOps, ...addIfNotExists]);
};

const updateProductOrderById = async (id_product, order) => {
    return await Product.updateOne(
        { _id: id_product },
        { $set: { "order": order } }
    );
};

const updatePreviousOrder = async (order) => {
    return await Product.updateOne(
        { order: order },
        { $set: { "order": order + 1 } }
    );
};

const updateNextOrder = async (order) => {
    return await Product.updateOne(
        { order: order },
        { $set: { "order": order } }
    );
};

module.exports = {
    Product,
    findByDomainAndSlug,
    findById,
    findAll,
    countAll,
    findByCategorySlug,
    countByCategorySlug,
    searchByTitle,
    countByTitle,
    getProductBySlugs,
    applyPromotionsToProducts,
    updateProductsOrder,
    updateProductsOrderByCategory,
    updateProductOrderById,
    updatePreviousOrder,
    updateNextOrder

};
