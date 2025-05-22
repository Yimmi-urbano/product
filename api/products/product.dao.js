const Product = require('./product.model');
const Variation = require('../variations/variations.model');
const Attribute = require('../attributes/attribute.model');

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

const findAll = (domain, skip, limit) =>
    Product.find({ domain, 'is_trash.status': false })
        .skip(skip)
        .limit(limit)
        .select('_id stock is_available image_default title price description_short slug');

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
    getProductBySlugs
};
