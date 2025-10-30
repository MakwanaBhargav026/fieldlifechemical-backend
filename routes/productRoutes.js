const express = require('express');
const router = express.Router();
const multer = require('multer');
const Product = require('../models/Product');
const ImageKit = require('imagekit');
require('dotenv').config();

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// Configure multer (store files in memory before upload)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
  }
});

// 🟢 Get all products
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};

    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };

    const products = await Product.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Error fetching products', error: error.message });
  }
});

// 🟢 Get product stats
router.get('/stats', async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const categoryCounts = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    res.json({ success: true, data: { total: totalProducts, categories: categoryCounts } });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics', error: error.message });
  }
});

// 🟢 Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ success: false, message: 'Product not found' });

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching product', error: error.message });
  }
});

// 🟢 Create product (upload image to ImageKit)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, category, description } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, message: 'Name and category are required' });
    }

    let imageUrl = null;

    if (req.file) {
      const uploadedImage = await imagekit.upload({
        file: req.file.buffer.toString('base64'),
        fileName: `product-${Date.now()}.jpg`
      });
      imageUrl = uploadedImage.url;
    }

    const product = new Product({
      name: name.trim(),
      category: category.trim(),
      description: description?.trim(),
      image: imageUrl
    });

    await product.save();
    res.status(201).json({ success: true, message: 'Product created successfully', data: product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Error creating product', error: error.message });
  }
});

// 🟡 Update product
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, category, description } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (name) product.name = name.trim();
    if (category) product.category = category.trim();
    if (description !== undefined) product.description = description.trim();

    if (req.file) {
      const uploadedImage = await imagekit.upload({
        file: req.file.buffer.toString('base64'),
        fileName: `product-${Date.now()}.jpg`
      });
      product.image = uploadedImage.url;
    }

    await product.save();
    res.json({ success: true, message: 'Product updated successfully', data: product });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Error updating product', error: error.message });
  }
});

// 🔴 Delete single product
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting product', error: error.message });
  }
});

// 🔴 Delete all products (development only)
router.delete('/', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Not allowed in production' });
    }
    const result = await Product.deleteMany({});
    res.json({ success: true, message: 'All products deleted', deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting all products', error: error.message });
  }
});

module.exports = router;
