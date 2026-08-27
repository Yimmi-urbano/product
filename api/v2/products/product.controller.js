const service = require('./product.service');

function isLegacyRequest(req) {
    return req.baseUrl === '/v1/products';
}

exports.list = async (req, res) => {
    try {
        if (isLegacyRequest(req)) {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const { products, pagination } = await service.listLegacyProducts(req.domain, req.query);

            return res.json({
                products,
                page,
                totalPages: pagination.totalPages,
                totalProducts: pagination.total,
                limit
            });
        }

        const { products, pagination } = await service.listProducts(req.domain, req.query);

        res.json({
            products,
            page: pagination.page,
            totalPages: pagination.totalPages,
            totalProducts: pagination.total,
            totalRecords: pagination.total,
            limit: pagination.limit,
            pagination
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.search = async (req, res) => {
    try {
        if (!req.query.query && !req.query.search) {
            return res.status(400).json({ message: 'Query required' });
        }

        if (isLegacyRequest(req)) {
            const page = parseInt(req.query.page) || 1;
            const query = req.query.search || req.query.query;
            const { products, pagination } = await service.listLegacyProducts(req.domain, {
                ...req.query,
                search: query
            });

            return res.json({
                products,
                page,
                totalPages: pagination.totalPages,
                totalProducts: pagination.total
            });
        }

        const { products, pagination } = await service.listProducts(req.domain, {
            ...req.query,
            search: req.query.search || req.query.query
        });

        res.json({
            products,
            page: pagination.page,
            totalPages: pagination.totalPages,
            totalProducts: pagination.total,
            totalRecords: pagination.total,
            limit: pagination.limit,
            pagination
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.byCategory = async (req, res) => {
    try {
        if (isLegacyRequest(req)) {
            const page = parseInt(req.query.page) || 1;
            const perPage = parseInt(req.query.limit) || 10;
            const { products, pagination } = await service.listLegacyProducts(req.domain, {
                ...req.query,
                category: req.params.categorySlug
            });

            return res.json({
                products: products.map(({ order, order_categorie, ...product }) => product),
                currentPage: page,
                totalPages: pagination.totalPages,
                totalRecords: pagination.total
            });
        }

        const { products, pagination } = await service.listProducts(req.domain, {
            ...req.query,
            category: req.params.categorySlug
        });

        res.json({
            products,
            currentPage: pagination.page,
            totalPages: pagination.totalPages,
            totalRecords: pagination.total,
            limit: pagination.limit,
            pagination
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getBySlug = async (req, res) => {
    try {
        if (isLegacyRequest(req)) {
            const product = await service.getLegacyProductBySlug(req.domain, req.params.slug);
            if (!product) return res.status(404).json({ message: 'Product not found' });
            return res.json(product);
        }

        const product = await service.getProductBySlug(req.domain, req.params.slug);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getById = async (req, res) => {
    try {
        if (isLegacyRequest(req)) {
            const product = await service.getLegacyProductById(req.domain, req.params.id);
            if (!product) return res.status(404).json({ message: 'Product not found' });
            return res.json(product);
        }

        const product = await service.getProductById(req.domain, req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
