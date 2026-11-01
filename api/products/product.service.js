const slugify = require('slugify');
const mongoose = require('mongoose');
const inventoryService = require('../inventory/inventory.service');
const { InventoryItem } = require('../inventory/inventory.models');
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
    getProductBySlugs,
    applyPromotionsToProducts,
    updateProductsOrder,
    updateProductsOrderByCategory,
    updateProductOrderById,
    updatePreviousOrder,
    updateNextOrder
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
    const initialStock = Math.max(0, Number(data.stock) || 0);
    const initialCost = data.cost_price ?? data.purchase_price;
    const hasInitialInventory = initialStock > 0 && Number.isFinite(Number(initialCost)) && Number(initialCost) >= 0;
    const session = await mongoose.startSession();
    let product;
    try {
        await session.withTransaction(async () => {
            product = new Product({
                ...data,
                slug,
                domain,
                stock: data.type_product === 'variable' || hasInitialInventory ? 0 : initialStock,
                cost_price: initialCost === undefined || initialCost === null || initialCost === ''
                    ? null
                    : Number(initialCost)
            });
            await product.save({ session });
            if (hasInitialInventory && data.type_product !== 'variable') {
                await inventoryService.createEntry(domain, {
                    date: data.inventory_date,
                    notes: 'Stock inicial creado con el producto',
                    lines: [{
                        productId: product._id,
                        name: product.title,
                        quantity: initialStock,
                        unitCost: Number(initialCost),
                        unit: 'unit'
                    }]
                }, { session });
            }
        });
        return Product.findById(product._id);
    } finally {
        await session.endSession();
    }
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

    const inventoryItem = await InventoryItem.exists({ tenantId: domain, productId: id, variationId: null });
    if (inventoryItem) {
        delete updateData.stock;
        delete updateData.cost_price;
        delete updateData.purchase_price;
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


/**
 * Actualizar orden general de productos
 */
const updateOrder = async (updates) => {
    if (!Array.isArray(updates)) {
        throw new Error("El body debe ser un array de productos con id_product y order");
    }

    return await updateProductsOrder(updates);
};

/**
 * Actualizar orden de productos por categoría
 */
const updateOrderByCategory = async (updates, name_category) => {
    if (!Array.isArray(updates)) {
        throw new Error("El body debe ser un array de productos con id_product y order");
    }
    return await updateProductsOrderByCategory(updates, name_category);
};

const updateSingleProductOrder = async ({ id_product, order, order_type }) => {
    try {
        
        const [previousUpdated, updatedProduct] = await Promise.all([
            order_type === "prev" ? updatePreviousOrder(order) : updateNextOrder(order),
            updateProductOrderById(id_product, order)
        ]);

        return {
            success: true,
            message: "Orden de producto actualizado",
            result: {
                updatedProduct,
                previousUpdated
            }
        };
    } catch (error) {
        return {
            success: false,
            message: "Error al actualizar el orden",
            error: error.message
        };
    }
};

module.exports = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductsByCategory,
    searchProducts,
    getProductBySlug,
    updateOrder,
    updateOrderByCategory,
    updateSingleProductOrder
};
