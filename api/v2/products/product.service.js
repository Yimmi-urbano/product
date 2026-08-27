const mongoose = require('mongoose');
const catalogModels = require('./catalog.models');
const { mapProduct, mapLegacyProduct } = require('./product.mapper');

const ACTIVE_PRODUCT = 'active';
const APPROVED_VENDOR = 'approved';
const MAX_LIMIT = 100;

function parsePositiveInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeList(value) {
    if (!value) return [];
    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function buildPagination(page, limit, total) {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
    };
}

function buildSort(sortBy, sortOrder) {
    const direction = sortOrder === 'asc' ? 1 : -1;

    if (sortBy === 'price-asc') return { price: 1 };
    if (sortBy === 'price-desc') return { price: -1 };
    if (sortBy === 'rating') return { rating: -1, reviewCount: -1 };
    if (sortBy === 'popular') return { reviewCount: -1, rating: -1, createdAt: -1 };
    if (sortBy === 'price') return { price: direction };

    return { createdAt: direction };
}

async function resolveVendor(domain) {
    if (!domain) return null;

    const normalizedDomain = String(domain).toLowerCase();
    const slugCandidate = normalizedDomain.replace(/\.creceidea\.pe$/, '');
    const query = mongoose.isValidObjectId(domain)
        ? { _id: domain, status: APPROVED_VENDOR, storeActive: { $ne: false } }
        : {
            slug: { $in: [normalizedDomain, slugCandidate] },
            status: APPROVED_VENDOR,
            storeActive: { $ne: false }
        };

    return catalogModels.Vendor().findOne(query).select('_id slug storeName logo isDefault').lean();
}

async function resolveCategoryFilter(values) {
    const normalized = normalizeList(values);
    if (normalized.length === 0) return undefined;

    const ids = normalized.filter((value) => mongoose.isValidObjectId(value));
    const slugs = normalized
        .filter((value) => !mongoose.isValidObjectId(value))
        .map((value) => value.toLowerCase());

    const categories = slugs.length
        ? await catalogModels.Category().find({ slug: { $in: slugs } }).select('_id').lean()
        : [];

    const resolvedIds = [...ids, ...categories.map((category) => String(category._id))];
    return resolvedIds.length ? { $in: resolvedIds.map((id) => new mongoose.Types.ObjectId(id)) } : null;
}

async function resolveBrandFilter(values) {
    const normalized = normalizeList(values);
    if (normalized.length === 0) return undefined;

    const ids = normalized.filter((value) => mongoose.isValidObjectId(value));
    const slugs = normalized
        .filter((value) => !mongoose.isValidObjectId(value))
        .map((value) => value.toLowerCase());

    const brands = slugs.length
        ? await catalogModels.Brand().find({ slug: { $in: slugs }, status: { $ne: 'inactive' } }).select('_id').lean()
        : [];

    const resolvedIds = [...ids, ...brands.map((brand) => String(brand._id))];
    return resolvedIds.length ? { $in: resolvedIds.map((id) => new mongoose.Types.ObjectId(id)) } : null;
}

async function buildQuery(domain, filters = {}) {
    const query = { status: ACTIVE_PRODUCT };
    const vendor = await resolveVendor(domain || filters.vendor);

    if (domain || filters.vendor) {
        if (!vendor) return null;
        query.vendorId = vendor._id;
    }

    if (filters.search) {
        const regex = new RegExp(String(filters.search).trim(), 'i');
        query.$or = [
            { name: regex },
            { title: regex },
            { description: regex },
            { shortDescription: regex },
            { tags: regex }
        ];
    }

    const categoryFilter = await resolveCategoryFilter(filters.category);
    if (categoryFilter === null) return null;
    if (categoryFilter) query.category = categoryFilter;

    const brandFilter = await resolveBrandFilter(filters.brand);
    if (brandFilter === null) return null;
    if (brandFilter) query.brand = brandFilter;

    if (filters.featured === 'true' || filters.featured === true) {
        query.featured = true;
    }

    return query;
}

function productQuery(query) {
    catalogModels.Vendor();
    catalogModels.Category();
    catalogModels.Brand();

    return catalogModels.Product().find(query)
        .populate('vendorId', 'storeName slug logo isDefault')
        .populate('category', 'name slug')
        .populate('brand', 'name slug logo');
}

async function listProducts(domain, params = {}) {
    const page = parsePositiveInt(params.page, 1);
    const limit = Math.min(MAX_LIMIT, parsePositiveInt(params.limit, 10));
    const query = await buildQuery(domain, params);

    if (!query) {
        return { products: [], pagination: buildPagination(page, limit, 0) };
    }

    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
        productQuery(query)
            .sort(buildSort(params.sortBy, params.sortOrder))
            .skip(skip)
            .limit(limit)
            .lean(),
        catalogModels.Product().countDocuments(query)
    ]);

    return {
        products: products.map(mapProduct),
        pagination: buildPagination(page, limit, total)
    };
}

async function listLegacyProducts(domain, params = {}) {
    const page = parsePositiveInt(params.page, 1);
    const limit = Math.min(MAX_LIMIT, parsePositiveInt(params.limit, 10));
    const query = await buildQuery(domain, params);

    if (!query) {
        return { products: [], pagination: buildPagination(page, limit, 0) };
    }

    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
        productQuery(query)
            .sort(buildSort(params.sortBy, params.sortOrder))
            .skip(skip)
            .limit(limit)
            .lean(),
        catalogModels.Product().countDocuments(query)
    ]);

    return {
        products: products.map((product, index) =>
            mapLegacyProduct(product, {
                includeOrder: true,
                order: skip + index + 1
            })
        ),
        pagination: buildPagination(page, limit, total)
    };
}

async function getProductBySlug(domain, slug) {
    const query = await buildQuery(domain);
    if (!query) return null;

    const product = await productQuery({
        ...query,
        $or: [{ slug }, { handle: slug }, { 'seo.handle': slug }]
    }).lean().then((docs) => docs[0]);

    return mapProduct(product);
}

async function getLegacyProductBySlug(domain, slug) {
    const query = await buildQuery(domain);
    if (!query) return null;

    const product = await productQuery({
        ...query,
        $or: [{ slug }, { handle: slug }, { 'seo.handle': slug }]
    }).lean().then((docs) => docs[0]);

    return mapLegacyProduct(product, { detail: true });
}

async function getProductById(domain, id) {
    if (!mongoose.isValidObjectId(id)) return null;

    const query = await buildQuery(domain);
    if (!query) return null;

    const product = await productQuery({ ...query, _id: id }).lean().then((docs) => docs[0]);
    return mapProduct(product);
}

async function getLegacyProductById(domain, id) {
    if (!mongoose.isValidObjectId(id)) return null;

    const query = await buildQuery(domain);
    if (!query) return null;

    const product = await productQuery({ ...query, _id: id }).lean().then((docs) => docs[0]);
    return mapLegacyProduct(product, { detail: true });
}

module.exports = {
    listProducts,
    listLegacyProducts,
    getProductBySlug,
    getLegacyProductBySlug,
    getProductById,
    getLegacyProductById
};
