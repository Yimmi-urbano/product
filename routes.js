const express = require('express');
const bodyParser = require('body-parser');
const { Product, db } = require('./db');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Rutas
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/products/categories', async (req,res) => {


  try {
    const products = await Product.find();
  const allCategories = [...new Set(products.flatMap(item => item.category))];
  console.log({allCategories})
    res.json(allCategories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

})

app.post('/products', async (req, res) => {
  const dbName = req.body.dbName || 'default'; // Si no se proporciona dbName, se usará 'default'
  const CustomProduct = Product.discriminator(`db-${dbName}.products`, new mongoose.Schema({}));
  const product = new CustomProduct({
    name: req.body.name,
    description: req.body.description,
    price: req.body.price,
  });

  try {
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
