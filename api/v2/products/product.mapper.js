function toPlainObject(doc) {
    if (!doc) return null;
    return typeof doc.toObject === 'function' ? doc.toObject() : doc;
}

function getProductImages(product) {
    if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images.filter(Boolean);
    }

    if (Array.isArray(product.media) && product.media.length > 0) {
        return product.media
            .filter((media) => (media.type || 'image') === 'image' && media.url)
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((media) => media.url);
    }

    return [];
}

function mapPrice(price, comparePrice) {
    const currentPrice = typeof price === 'number' ? price : 0;
    const regularPrice =
        typeof comparePrice === 'number' && comparePrice > currentPrice
            ? comparePrice
            : currentPrice;

    return {
        regular: regularPrice,
        sale: currentPrice,
        tag: regularPrice > currentPrice ? 'Oferta' : undefined
    };
}

function mapCategory(category) {
    if (!category) return [];
    if (typeof category === 'string') return [{ _id: category }];

    return [
        {
            _id: category._id,
            name: category.name,
            slug: category.slug
        }
    ];
}

function mapBrand(brand) {
    if (!brand) return null;
    if (typeof brand === 'string') return { _id: brand };
    return {
        _id: brand._id,
        name: brand.name,
        slug: brand.slug,
        logo: brand.logo
    };
}

function mapVariant(variant) {
    const legacyPrice = variant.legacy?.price;

    return {
        _id: variant._id,
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        stock: variant.stock || 0,
        isAvailable:
            variant.inventory?.tracked === false ||
            variant.inventory?.continueSellingWhenOutOfStock === true ||
            (variant.stock || 0) > 0,
        price: legacyPrice || mapPrice(variant.price, variant.comparePrice),
        image: variant.image,
        attributes: variant.attributes || [],
        optionValues: variant.optionValues || []
    };
}

function mapProduct(doc) {
    const product = toPlainObject(doc);
    if (!product) return null;

    const images = getProductImages(product);
    const variants = Array.isArray(product.variants) ? product.variants.map(mapVariant) : [];
    const inStock =
        product.inventory?.tracked === false ||
        product.inventory?.continueSellingWhenOutOfStock === true ||
        variants.some((variant) => variant.isAvailable) ||
        (product.stock || 0) > 0;

    return {
        _id: product._id,
        vendorId: product.vendorId,
        domain: product.vendorId?.slug,
        title: product.title || product.name,
        name: product.name || product.title,
        slug: product.slug || product.handle,
        handle: product.handle,
        type_product: product.productType || (product.shipping?.isPhysicalProduct === false ? 'digital' : 'physical'),
        productType: product.productType,
        image_default: images,
        images,
        media: product.media || [],
        stock: product.stock || 0,
        is_available: product.status === 'active' && inStock,
        status: product.status,
        price: mapPrice(product.price, product.comparePrice),
        priceRange: product.priceRange,
        compareAtPriceRange: product.compareAtPriceRange,
        description_short: product.shortDescription,
        description_long: product.description,
        shortDescription: product.shortDescription,
        description: product.description,
        category: mapCategory(product.category),
        brand: mapBrand(product.brand),
        tags: product.tags || [],
        attributes: product.attributes || [],
        options: product.options || [],
        variations: variants,
        variants,
        featured: Boolean(product.featured),
        rating: product.rating || 0,
        reviewCount: product.reviewCount || 0,
        legacy: product.legacy,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
    };
}

function mapLegacyProduct(doc, options = {}) {
    const product = mapProduct(doc);
    if (!product) return null;

    const legacyProduct = {
        _id: product._id,
        stock: product.stock,
        is_available: product.is_available,
        image_default: product.image_default,
        title: product.title,
        price: product.legacy?.price || product.price,
        description_short: product.description_short,
        slug: product.slug,
        type_product: product.legacy?.type_product || product.type_product
    };

    if (options.includeOrder) {
        legacyProduct.order = product.legacy?.order ?? product.order ?? options.order ?? 0;
        legacyProduct.order_categorie = product.legacy?.order_categorie || product.order_categorie || [];
    }

    if (options.includeCategory) {
        legacyProduct.category = product.category;
    }

    if (options.detail) {
        return {
            ...legacyProduct,
            domain: product.legacy?.domain || product.domain,
            is_trash: {
                status: product.status !== 'active',
                date: undefined
            },
            category: product.legacy?.category || product.category,
            order: product.legacy?.order ?? product.order ?? options.order ?? 0,
            order_categorie: product.legacy?.order_categorie || product.order_categorie || [],
            default_variations: [],
            description_long: product.description_long,
            createdAt: product.createdAt,
            variations: product.variations,
            attributes: product.attributes
        };
    }

    return legacyProduct;
}

module.exports = {
    mapProduct,
    mapLegacyProduct
};
