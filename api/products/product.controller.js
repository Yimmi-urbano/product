const service = require('./product.service');

exports.create = async (req, res) => {
    try {
        const product = await service.createProduct(req.domain, req.body);
        res.status(201).json(product);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.list = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const { products, total } = await service.getProducts(req.domain, page, limit);
        res.json({ products, page, totalPages: Math.ceil(total / limit), totalProducts: total, limit });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const product = await service.getProductById(req.domain, req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.update = async (req, res) => {
    try {
        const updated = await service.updateProduct(req.domain, req.params.id, req.body);
        if (!updated) return res.status(404).json({ message: 'Product not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.remove = async (req, res) => {
    try {
        await service.deleteProduct(req.domain, req.params.id);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.byCategory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const perPage = 10;
        const { products, total } = await service.getProductsByCategory(req.domain, req.params.categorySlug, page, perPage);
        res.json({ products, currentPage: page, totalPages: Math.ceil(total / perPage), totalRecords: total });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.bySlug = async (req, res) => {
    try {
        const product = await service.getProductById(req.domain, req.params.slug);
        if (!product) return res.status(404).json({ message: 'Not found' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getProductBySlug = async (req, res) => {
    try {
        const product = await service.getProductBySlug(req.domain, req.params.slug);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.search = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;

        const limit = 10;
        const query = req.query.query;
        if (!query) return res.status(400).json({ message: 'Query required' });
        const { products, total } = await service.searchProducts(req.domain, query, page, limit);
        res.json({ products, page, totalPages: Math.ceil(total / limit), totalProducts: total });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


exports.updateProductOrder = async (req, res) => {
    try {
        const result = await service.updateOrder(req.body);
        res.json({ success: true, message: "Orden de productos actualizado", result });
    } catch (error) {
        console.error("updateProductOrder error:", error);
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateProductOrderByCategory = async (req, res) => {
    try {
        const { name_category } = req.params;
        const result = await service.updateOrderByCategory(req.body, name_category);
        res.json({ success: true, message: `Orden en categoría '${name_category}' actualizado`, result });
    } catch (error) {
        console.error("updateProductOrderByCategory error:", error);
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateSingleProductOrderController = async (req, res) => {
    try {
        const body = req.body;
        const result = await service.updateSingleProductOrder(body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error en el controlador",
            error: error.message
        });
    }
};
