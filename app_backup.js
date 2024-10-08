const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const slugify = require('slugify');
const cors = require('cors');
const app = express();
const PORT = 4600;

app.use(bodyParser.json());
app.use(cors());

mongoose.connect('mongodb+srv://data_user:wY1v50t8fX4lMA85@cluster0.entyyeb.mongodb.net/product', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const ProductSchema = new mongoose.Schema({
    title: { type: String, required: true },
    id_product: { type: String },
    sku: { type: String },
    slug: { type: String },
    type_product: { type: String, required: true },
    image_default: [{ type: String, required: true }],
    stock: { type: Number, required: true },
    category: [
        {
            idcat: { type: String, required: true },
            slug: { type: String, required: true }
        }
    ],
    is_available: { type: Boolean, required: true },
    is_trash: {
        status: { type: Boolean },
        date: { type: String }
    },
    price: {
        regular: { type: Number, required: true },
        sale: { type: Number, required: true },
        tag: { type: String }
    },
    default_variations: [{ type: String }],
    atributos: [{
        name_attr: { type: String, required: true },
        values: [{
            Id: { type: String, required: true },
            valor: { type: String, required: true }
        }]
    }],
    variations: [{
        chill_attr: [{ type: String, required: true }],
        price: {
            regular: { type: Number, required: true },
            sale: { type: Number, required: true },
            tag: { type: String }
        }
    }],
    description_long: { type: String, required: true },
    description_short: { type: String, required: true }
});

function getCollectionName(domain) {
    return `products-${domain}`;
}

app.get('/api/products', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);

        const projection = {
            id: 1,
            stock: 1,
            is_available: 1,
            image_default: 1,
            title: 1,
            price: 1,
            description_short: 1,
            slug:1
        };

        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        const totalProducts = await ProductModel.countDocuments({ 'is_trash.status': false });
        const products = await ProductModel.find({ 'is_trash.status': false }, projection)
            .skip(skip)
            .limit(limit);

        res.json({
            products,
            page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtener todas las categorías únicas
app.get('/api/categories', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);
        const products = await ProductModel.find();

        const allCategories = [...new Set(products.flatMap(item => item.category))];

        res.json(allCategories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Obtener un producto por ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);

        const product = await ProductModel.findOne({ _id: req.params.id, 'is_trash.status': false });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Obtener un producto por Slug Tienda Final
app.get('/api/client/products/:slug', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);

        const product = await ProductModel.findOne({ slug: req.params.slug, 'is_trash.status': false });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Crear un nuevo producto
app.post('/api/products', async (req, res) => {
    const domain = req.headers['domain'];
    if (!domain) {
        return res.status(400).json({ message: 'Domain header is required' });
    }
    
    const collectionName = getCollectionName(domain);
    const ProductModel = mongoose.model('Product', ProductSchema, collectionName);

    let productData = req.body;
    
    try {
        // Generar slug basado en el título
        let generatedSlug = slugify(productData.title, { lower: true, strict: true });
        let existingProduct = await ProductModel.findOne({ slug: generatedSlug });

        // Si ya existe un producto con el slug generado, agregar "-2"
        if (existingProduct) {
            let suffix = 2;
            let newSlug = `${generatedSlug}-${suffix}`;
            while (await ProductModel.findOne({ slug: newSlug })) {
                suffix++;
                newSlug = `${generatedSlug}-${suffix}`;
            }
            generatedSlug = newSlug;
        }

        productData.slug = generatedSlug;

        // Crear un nuevo producto
        const product = new ProductModel(productData);
        const newProduct = await product.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Actualizar un producto
app.patch('/api/products/:id', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);

        let updateData = req.body;

        // Si se está actualizando el título, generar un nuevo slug
        if (updateData.title) {
            let generatedSlug = slugify(updateData.title, { lower: true, strict: true });
            let existingProduct = await ProductModel.findOne({ slug: generatedSlug });

            // Verificar si el slug ya existe, y agregar "-2" si es necesario
            if (existingProduct && existingProduct._id.toString() !== req.params.id) {
                let suffix = 2;
                let newSlug = `${generatedSlug}-${suffix}`;
                while (await ProductModel.findOne({ slug: newSlug })) {
                    suffix++;
                    newSlug = `${generatedSlug}-${suffix}`;
                }
                generatedSlug = newSlug;
            }

            updateData.slug = generatedSlug;
        }

        // Actualizar el producto
        const product = await ProductModel.findOneAndUpdate(
            { _id: req.params.id }, 
            updateData, 
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Borrar un producto
app.delete('/api/products/:id', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);
        const product = await ProductModel.findOneAndDelete({ _id: req.params.id });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Borrar un producto (actualizar su estado a trash)
app.delete('/api/products/:id/trash', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);

        // Actualizar el estado de is_trash a true y guardar la fecha
        const product = await ProductModel.findOneAndUpdate(
            { _id: req.params.id },
            { $set: { 'is_trash.status': true, 'is_trash.date': new Date().toISOString() } },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found', status: false });
        }

        // Extracción de los datos necesarios
        const { title, sku, _id } = product;

        // Enviar mensaje de respuesta con el título, ID y SKU del producto
        res.json({ message: 'Product status updated to trash', title, id: _id, sku });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Recuperar un producto (actualizar su estado a trash)
app.patch('/api/products/:id/recovery', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);

        // Actualizar el estado de is_trash a true y guardar la fecha
        const product = await ProductModel.findOneAndUpdate(
            { _id: req.params.id },
            { $set: { 'is_trash.status': false, 'is_trash.date': new Date().toISOString() } },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Extracción de los datos necesarios
        const { title, sku, _id } = product;

        // Enviar mensaje de respuesta con el título, ID y SKU del producto
        res.json({ message: 'Product status updated to trash', title, id: _id, sku });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Búsqueda de productos por categoría con paginación
app.get('/api/products/category/:categorySlug', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);

        const categorySlug = req.params.categorySlug;
        const page = parseInt(req.query.page) || 1;
        const perPage = 8;

        // Usamos la propiedad `category.slug` para buscar
        const totalCount = await ProductModel.countDocuments({
            'category.slug': categorySlug,
            'is_trash.status': false
        });
        const totalPages = Math.ceil(totalCount / perPage);

        const products = await ProductModel.find({
            'category.slug': categorySlug,
            'is_trash.status': false
        })
            .skip((page - 1) * perPage)
            .limit(perPage);

        res.json({
            products,
            currentPage: page,
            totalPages,
            totalRecords: totalCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Búsqueda de productos por título con paginación
app.get('/api/products/title/:title', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);

        const title = req.params.title;
        const page = parseInt(req.query.page) || 1;
        const perPage = 8;

        const totalCount = await ProductModel.countDocuments({ title: { $regex: title, $options: 'i' }, 'is_trash.status': false });
        const totalPages = Math.ceil(totalCount / perPage);

        const products = await ProductModel.find({ title: { $regex: title, $options: 'i' }, 'is_trash.status': false })
            .skip((page - 1) * perPage)
            .limit(perPage);

        res.json({
            products: products,
            currentPage: page,
            totalPages: totalPages,
            totalRecords: totalCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Middleware para manejar errores 404
app.use((req, res) => {
    res.status(404).json({ message: 'Not found' });
});

// Middleware para manejar errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
