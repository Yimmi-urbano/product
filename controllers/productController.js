
const slugify = require('slugify');
const DomainProductModel = require('../models/domainProductModel');

exports.createProduct = async (req, res) => {
    const domain = req.domain;
    let productData = req.body;

    try {
        let generatedSlug = slugify(productData.title, { lower: true, strict: true });

        let domainDoc = await DomainProductModel.findOne({ domain });
        if (!domainDoc) {
            domainDoc = new DomainProductModel({
                domain,
                products: []
            });
        }

        let existingProduct = domainDoc.products.find(p => p.slug === generatedSlug);

        if (existingProduct) {
            let suffix = 2;
            let newSlug = `${generatedSlug}-${suffix}`;
            while (domainDoc.products.find(p => p.slug === newSlug)) {
                suffix++;
                newSlug = `${generatedSlug}-${suffix}`;
            }
            generatedSlug = newSlug;
        }

        productData.slug = generatedSlug;

        domainDoc.products.push(productData);

        await domainDoc.save();
        res.status(201).json(productData);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const domain = req.domain;

        const projection = {
            _id: 1,
            stock: 1,
            is_available: 1,
            image_default: 1,
            title: 1,
            price: 1,
            description_short: 1,
            slug: 1
        };

        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        // Encontrar el documento para el dominio dado
        const domainDoc = await DomainProductModel.findOne({ domain });

        if (!domainDoc) {
            return res.status(404).json({ message: 'No products found for this domain' });
        }

        // Filtrar productos que no están en la papelera (is_trash.status = false)
        const filteredProducts = domainDoc.products.filter(product => !product.is_trash.status);

        // Obtener la cantidad total de productos filtrados
        const totalProducts = filteredProducts.length;

        // Paginación
        const products = filteredProducts
            .slice(skip, skip + limit)
            .map(product => {
                // Proyectar solo los campos seleccionados
                return {
                    _id: product._id,
                    stock: product.stock,
                    is_available: product.is_available,
                    image_default: product.image_default,
                    title: product.title,
                    price: product.price,
                    description_short: product.description_short,
                    slug: product.slug
                };
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

        // Encontrar el documento del dominio dado
        const domainDoc = await DomainProductModel.findOne({ domain });

        if (!domainDoc) {
            return res.status(404).json({ message: 'No products found for this domain' });
        }

        // Buscar el producto por ID dentro del array de productos y que no esté en la papelera
        const product = domainDoc.products.find(p => p._id.toString() === productId && !p.is_trash.status);

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

        // Buscar el documento del dominio
        const domainDoc = await DomainProductModel.findOne({ domain });

        if (!domainDoc) {
            return res.status(404).json({ message: 'No products found for this domain' });
        }

        // Buscar el producto dentro del array
        let product = domainDoc.products.find(p => p._id.toString() === productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Si se está actualizando el título, generar un nuevo slug
        if (updateData.title) {
            let generatedSlug = slugify(updateData.title, { lower: true, strict: true });

            // Verificar si ya existe otro producto con el mismo slug
            const existingProduct = domainDoc.products.find(p => p.slug === generatedSlug && p._id.toString() !== productId);

            if (existingProduct) {
                let suffix = 2;
                let newSlug = `${generatedSlug}-${suffix}`;
                while (domainDoc.products.find(p => p.slug === newSlug)) {
                    suffix++;
                    newSlug = `${generatedSlug}-${suffix}`;
                }
                generatedSlug = newSlug;
            }

            updateData.slug = generatedSlug;
        }

        // Actualizar el producto con los nuevos datos
        product = Object.assign(product, updateData);

        // Guardar el documento actualizado
        await domainDoc.save();

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

        // Buscar el documento del dominio
        const domainDoc = await DomainProductModel.findOne({ domain });

        if (!domainDoc) {
            return res.status(404).json({ message: 'No products found for this domain' });
        }

        // Filtrar los productos por el `category.slug`
        const filteredProducts = domainDoc.products.filter(product => 
            product.category.some(cat => cat.slug === categorySlug) &&
            product.is_trash.status === false
        );

        const totalCount = filteredProducts.length;
        const totalPages = Math.ceil(totalCount / perPage);
        
        // Paginación
        const paginatedProducts = filteredProducts.slice((page - 1) * perPage, page * perPage);

        res.json({
            products: paginatedProducts,
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

        // Buscar el documento del dominio
        const domainDoc = await DomainProductModel.findOne({ domain });

        if (!domainDoc) {
            return res.status(404).json({ message: 'No products found for this domain' });
        }

        // Buscar el producto por slug y verificar que no esté en la papelera
        const product = domainDoc.products.find(product => 
            product.slug === productSlug && product.is_trash.status === false
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.trashProduct = async (req, res) => {
    try {
        const domain = req.domain;
        const productId = req.params.id;

        // Buscar el documento del dominio
        const domainDoc = await DomainProductModel.findOne({ domain });

        if (!domainDoc) {
            return res.status(404).json({ message: 'No products found for this domain' });
        }

        // Encontrar el producto por ID
        const product = domainDoc.products.find(p => p._id.toString() === productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Actualizar el estado de is_trash a true
        product.is_trash.status = true;
        product.is_trash.date = new Date().toISOString();

        await domainDoc.save();

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

exports.recoverProduct = async (req, res) => {
    try {
        const domain = req.domain;
        const productId = req.params.id;

        // Buscar el documento del dominio
        const domainDoc = await DomainProductModel.findOne({ domain });

        if (!domainDoc) {
            return res.status(404).json({ message: 'No products found for this domain' });
        }

        // Encontrar el producto por ID
        const product = domainDoc.products.find(p => p._id.toString() === productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Actualizar el estado de is_trash a false
        product.is_trash.status = false;
        product.is_trash.date = new Date().toISOString();

        await domainDoc.save();

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

        // Buscar el documento del dominio
        const domainDoc = await DomainProductModel.findOne({ domain });

        if (!domainDoc) {
            return res.status(404).json({ message: 'No products found for this domain' });
        }

        // Buscar el índice del producto por ID
        const productIndex = domainDoc.products.findIndex(p => p._id.toString() === productId);

        if (productIndex === -1) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Eliminar el producto del array de productos
        domainDoc.products.splice(productIndex, 1);

        // Guardar el documento del dominio
        await domainDoc.save();

        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

