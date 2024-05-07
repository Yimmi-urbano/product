const express = require('express');
const mongoose = require('mongoose'); // Importa mongoose aquí
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Conexión a MongoDB
mongoose.connect('mongodb+srv://data_user:wY1v50t8fX4lMA85@cluster0.entyyeb.mongodb.net/product', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Modelo de producto
const ProductSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    type_product: { type: String, required: true },
    stock: { type: Number, required: true },
    is_aviable: { type: Boolean, required: true },
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

// Función para obtener el nombre de la colección basado en el dominio
function getCollectionName(domain) {
    return `products-${domain}`;
}

// Rutas de la API

// Obtener todos los productos
app.get('/api/products', async (req, res) => {
    try {
        const domain = req.headers['domain'];
        if (!domain) {
            return res.status(400).json({ message: 'Domain header is required' });
        }
        const collectionName = getCollectionName(domain);
        const ProductModel = mongoose.model('Product', ProductSchema, collectionName);

        // Define los campos que deseas devolver
        const projection = {
            id: 1,
            stock: 1,
            is_aviable: 1,
            title: 1,
            price: 1,
            description_short:1
            // Agrega otros campos que desees incluir en la respuesta
        };

        // Realiza la consulta con la proyección de campos
        const products = await ProductModel.find({}, projection);

        res.json(products);
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

        const product = await ProductModel.findOne({ id: req.params.id });
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

    const product = new ProductModel(req.body);

    try {
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
        const product = await ProductModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
        const product = await ProductModel.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json({ message: 'Product deleted' });
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
