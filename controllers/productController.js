const slugify = require('slugify');
const DomainProductModel = require('../models/domainProductModel');

exports.createProduct = async (req, res) => {
    const domain = req.domain;
    let productData = req.body;

    try {
        let generatedSlug = slugify(productData.title, { lower: true, strict: true });

        let existingProduct = await DomainProductModel.findOne({ domain, slug: generatedSlug });

        if (existingProduct) {
            let suffix = 2;
            let newSlug = `${generatedSlug}-${suffix}`;
            while (await DomainProductModel.findOne({ domain, slug: newSlug })) {
                suffix++;
                newSlug = `${generatedSlug}-${suffix}`;
            }
            generatedSlug = newSlug;
        }

        productData.slug = generatedSlug;
        productData.domain = domain; 

        const newProduct = new DomainProductModel(productData);
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const domain = req.domain;

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const products = await DomainProductModel.find({
            domain,
            'is_trash.status': false
        })
        .skip(skip)
        .limit(limit)
        .select('_id stock is_available image_default title price description_short slug');

        const totalProducts = await DomainProductModel.countDocuments({
            domain,
            'is_trash.status': false
        });

        res.json({
            products,
            page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const domain = req.domain;
        const productId = req.params.id;

        const product = await DomainProductModel.findOne({ domain, _id: productId, 'is_trash.status': false });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const domain = req.domain;
        const productId = req.params.id;
        let updateData = req.body;

        let product = await DomainProductModel.findOne({ domain, _id: productId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (updateData.title) {
            let generatedSlug = slugify(updateData.title, { lower: true, strict: true });

            const existingProduct = await DomainProductModel.findOne({ domain, slug: generatedSlug, _id: { $ne: productId } });

            if (existingProduct) {
                let suffix = 2;
                let newSlug = `${generatedSlug}-${suffix}`;
                while (await DomainProductModel.findOne({ domain, slug: newSlug })) {
                    suffix++;
                    newSlug = `${generatedSlug}-${suffix}`;
                }
                generatedSlug = newSlug;
            }

            updateData.slug = generatedSlug;
        }

        Object.assign(product, updateData);
        await product.save();

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProductsByCategory = async (req, res) => {
    try {
        const domain = req.domain;
        const categorySlug = req.params.categorySlug;
        const page = parseInt(req.query.page) || 1;
        const perPage = 8;

        const filteredProducts = await DomainProductModel.find({ 
            domain, 
            'category.slug': categorySlug, 
            'is_trash.status': false 
        })
        .skip((page - 1) * perPage)
        .limit(perPage);

        const totalCount = await DomainProductModel.countDocuments({ domain, 'category.slug': categorySlug, 'is_trash.status': false });
        const totalPages = Math.ceil(totalCount / perPage);

        res.json({
            products: filteredProducts,
            currentPage: page,
            totalPages,
            totalRecords: totalCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProductBySlug = async (req, res) => {
    try {
        const domain = req.domain;
        const productSlug = req.params.slug;

        const product = await DomainProductModel.findOne({ 
            domain, 
            slug: productSlug, 
            'is_trash.status': false 
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.searchProductsByTitle = async (req, res) => {
    try {
        const domain = req.domain;
        const { query } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        console.log(domain,query)

        if (!query) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const filter = {
            domain,
            title: { $regex: query, $options: 'i' },
            'is_trash.status': false
        };

        const products = await DomainProductModel.find(filter)
            .skip(skip)
            .limit(limit)
            .select('_id stock is_available image_default title price description_short slug');

        const totalProducts = await DomainProductModel.countDocuments(filter);

        res.json({
            products,
            page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


/* Descomentar cuando se tenga la funcionalidad de papelera para los clientes
exports.trashProduct = async (req, res) => {
    try {
        const domain = req.domain;
        const productId = req.params.id;

        const product = await DomainProductModel.findOne({ domain, _id: productId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.is_trash.status = true;
        product.is_trash.date = new Date().toISOString();

        await product.save();

        res.json({
            message: 'Product status updated to trash',
            title: product.title,
            id: product._id,
            sku: product.sku
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
*/

exports.trashProduct = async (req, res) => {
    try {
        const domain = req.domain;
        const productId = req.params.id;

        const product = await DomainProductModel.findOne({ domain, _id: productId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        await DomainProductModel.deleteOne({ _id: productId });

        res.json({ message: 'Product permanently deleted', id: productId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.recoverProduct = async (req, res) => {
    try {
        const domain = req.domain;
        const productId = req.params.id;

        const product = await DomainProductModel.findOne({ domain, _id: productId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.is_trash.status = false;
        product.is_trash.date = new Date().toISOString();

        await product.save();

        res.json({
            message: 'Product recovered from trash',
            title: product.title,
            id: product._id,
            sku: product.sku
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const domain = req.domain;
        const productId = req.params.id;

        const product = await DomainProductModel.findOne({ domain, _id: productId });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        await product.remove();

        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
