const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const productController = require('./controllers/productController');
const validateDomain = require('./middlewares/validateDomain');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.post('/api/products', validateDomain, productController.createProduct);
app.get('/api/products', validateDomain, productController.getProducts);
app.get('/api/products/:id', validateDomain, productController.getProductById);
app.patch('/api/products/:id', validateDomain, productController.updateProduct);
app.get('/api/products/category/:categorySlug', validateDomain, productController.getProductsByCategory);
app.get('/api/client/products/:slug', validateDomain, productController.getProductBySlug);
app.delete('/api/products/:id/trash', validateDomain, productController.trashProduct);
app.patch('/api/products/:id/recovery', validateDomain, productController.recoverProduct);
app.delete('/api/products/:id', validateDomain, productController.deleteProduct);


app.use((req, res) => {
    res.status(404).json({ message: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
