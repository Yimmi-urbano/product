const slugify = require('slugify');
const {
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
} = require('./product.dao');

async function generateUniqueSlug(domain, title, excludeId = null) {
    let baseSlug = slugify(title, { lower: true, strict: true });
    let slug = baseSlug;
    let suffix = 2;

    while (await findByDomainAndSlug(domain, slug).then(p => p && (!excludeId || p._id.toString() !== excludeId))) {
        slug = `${baseSlug}-${suffix++}`;
    }

    return slug;
}

async function createProduct(domain, data) {
    const slug = await generateUniqueSlug(domain, data.title);
    const product = new Product({ ...data, slug, domain });
    return product.save();
}

async function getProducts(domain, page, limit) {
    const skip = (page - 1) * limit;
    const products = await findAll(domain, skip, limit);
    const total = await countAll(domain);
    return { products, total };
}

async function getProductById(domain, id) {
    return findById(domain, id);
}

async function updateProduct(domain, id, updateData) {
    const product = await Product.findOne({ domain, _id: id });
    if (!product) return null;

    if (updateData.title) {
        updateData.slug = await generateUniqueSlug(domain, updateData.title, id);
    }

    Object.assign(product, updateData);
    return product.save();
}

async function deleteProduct(domain, id) {
    return Product.deleteOne({ domain, _id: id });
}

async function getProductsByCategory(domain, slug, page, perPage) {
    const skip = (page - 1) * perPage;
    const products = await findByCategorySlug(domain, slug, skip, perPage);
    const total = await countByCategorySlug(domain, slug);
    return { products, total };
}

async function searchProducts(domain, query, page, limit) {
    const skip = (page - 1) * limit;
    const products = await searchByTitle(domain, query, skip, limit);
    const total = await countByTitle(domain, query);
    return { products, total };
}

async function getProductBySlug(domain, slug) {
    return await getProductBySlugs(domain, slug);
}


module.exports = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductsByCategory,
    searchProducts,
    getProductBySlug
};
