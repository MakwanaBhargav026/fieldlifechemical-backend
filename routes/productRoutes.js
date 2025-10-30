const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename: product-1234567890-987654321.jpg
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `product-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// @route   GET /api/products
// @desc    Get all products with optional filtering
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};
    
    // Filter by category if provided
    if (category) {
      query.category = category;
    }
    
    // Search in name if provided
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    console.log('Finding products with query:', query);
    const products = await Product.find(query).sort({ createdAt: -1 });
    console.log(`Found ${products.length} products`);

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// @route   GET /api/products/stats
// @desc    Get product statistics
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    
    const categoryCounts = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        total: totalProducts,
        categories: categoryCounts
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    
    // Handle invalid ObjectId format
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Product not found - Invalid ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// @route   POST /api/products
// @desc    Create new product with image
// @access  Public
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, category, description } = req.body;
    
    // Validate required fields
    if (!name || !category) {
      // Delete uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Name and category are required'
      });
    }

    // Create product object
    const productData = {
      name: name.trim(),
      category: category.trim(),
      description: description ? description.trim() : undefined,
      image: req.file ? `/uploads/${req.file.filename}` : undefined
    };

    const product = new Product(productData);
    await product.save();
    
    console.log('Product created:', product);

    res.status(201).json({ 
      success: true, 
      message: 'Product created successfully',
      data: product 
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Delete uploaded file if product creation fails
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error creating product',
      error: error.message 
    });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Public
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, category, description } = req.body;

    // Find existing product
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      // Delete uploaded file if product not found
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update fields
    if (name) product.name = name.trim();
    if (category) product.category = category.trim();
    if (description !== undefined) product.description = description.trim();

    // Update image if new one is uploaded
    if (req.file) {
      // Delete old image if exists
      if (product.image) {
        const oldImagePath = path.join(__dirname, '..', product.image);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
            console.log('Old image deleted:', oldImagePath);
          } catch (unlinkError) {
            console.error('Error deleting old image:', unlinkError);
          }
        }
      }
      product.image = `/uploads/${req.file.filename}`;
    }

    await product.save();
    console.log('Product updated:', product);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
    // Delete uploaded file if update fails
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    // Handle invalid ObjectId format
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Product not found - Invalid ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Public
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete image file if exists
    if (product.image) {
      const imagePath = path.join(__dirname, '..', product.image);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
          console.log('Image deleted successfully:', imagePath);
        } catch (unlinkError) {
          console.error('Error deleting image:', unlinkError);
        }
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    console.log('Product deleted:', req.params.id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    
    // Handle invalid ObjectId format
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Product not found - Invalid ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

// @route   DELETE /api/products
// @desc    Delete all products (for testing/development only)
// @access  Public
router.delete('/', async (req, res) => {
  try {
    // Security check - only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'This operation is not allowed in production'
      });
    }

    // Get all products to delete their images
    const products = await Product.find({});
    
    // Delete all image files
    let deletedImages = 0;
    products.forEach(product => {
      if (product.image) {
        const imagePath = path.join(__dirname, '..', product.image);
        if (fs.existsSync(imagePath)) {
          try {
            fs.unlinkSync(imagePath);
            deletedImages++;
          } catch (unlinkError) {
            console.error('Error deleting image:', unlinkError);
          }
        }
      }
    });

    const result = await Product.deleteMany({});

    res.json({
      success: true,
      message: `All products deleted successfully`,
      deletedProducts: result.deletedCount,
      deletedImages: deletedImages
    });
  } catch (error) {
    console.error('Error deleting products:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting products',
      error: error.message
    });
  }
});

module.exports = router;