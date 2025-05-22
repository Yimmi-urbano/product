const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const productRouter = require('./api/products/products.router');
const attributesRouter = require('./api/attributes/attribute.router');
const variationsRouter = require('./api/variations/variations.router');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.use('/api/products', productRouter);
app.use('/api/attributes', attributesRouter);
app.use('/api/variations', variationsRouter);


app.use((req, res) => {
    res.status(404).json({ message: 'Not found' });
});

app.use(errorHandler);

module.exports = app;