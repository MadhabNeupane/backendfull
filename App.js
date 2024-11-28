require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Cloudinary configuration
cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err.message));

// Express setup
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, 'public')));

// Multer setup for file uploads
const uploader = multer({
  storage: multer.diskStorage({}),
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, or PDF files are allowed!'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// Mongoose Schema and Model for Store
const bookSchema = new mongoose.Schema({
  file_url: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
});
const Book = mongoose.model('Book', bookSchema);

// Cloudinary file upload helper
const uploadFileToCloudinary = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath);
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error.message);
    throw error;
  }
};

// Upload file route
app.post('/api/upload-file', uploader.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, msg: 'No file uploaded!' });
    }

    // Upload file to Cloudinary
    const upload = await uploadFileToCloudinary(req.file.path);

    // Save file URL in the database
    const { name, price, quantity } = req.body; // Expecting these from the request body
    const newBook = new Book({
      file_url: upload.secure_url,
      name,
      price,
      quantity,
    });

    const record = await newBook.save();

    // Cleanup uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('File deletion error:', err.message);
    });

    res.status(200).json({ success: true, msg: 'File uploaded successfully!', data: record });
  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
});

// Route to fetch all books
app.get('/books', async (req, res) => {
  try {
    const books = await Book.find();
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
});

// Start the app
app.listen(3000, () => {
  console.log('App is running on port 3000');
});
