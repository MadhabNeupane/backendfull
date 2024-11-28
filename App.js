require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Joi = require('joi');

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Express setup
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup for file uploads
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Mongoose Schema and Models
const storeSchema = new mongoose.Schema({
  file_url: { type: String, required: true },
});
const Store = mongoose.model('Store', storeSchema);

const bookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  description: { type: String },
  image: { type: String }, // URL for book image
});
const Book = mongoose.model('Book', bookSchema);

// Validation schema for adding or updating books
const bookValidationSchema = Joi.object({
  name: Joi.string().required(),
  price: Joi.number().min(0).required(),
  quantity: Joi.number().integer().min(0).required(),
  description: Joi.string().optional(),
  image: Joi.string().uri().optional(),
});

// Function to upload a file to Cloudinary
const uploadFileToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
    stream.end(fileBuffer); // Send the file buffer to the stream
  });
};

// Routes
app.get('/books', async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

app.post('/books', async (req, res) => {
  const { error } = bookValidationSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { name, price, quantity, description, image } = req.body;

  try {
    let book = await Book.findOne({ name });
    if (book) {
      book.quantity += quantity;
      await book.save();
    } else {
      book = new Book({ name, price, quantity, description, image });
      await book.save();
    }
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add or update book' });
  }
});

app.post('/books/sell', async (req, res) => {
  const { name, quantity } = req.body;

  try {
    const book = await Book.findOne({ name });
    if (!book || book.quantity < quantity) {
      return res.status(400).json({ error: 'Not enough stock or book unavailable' });
    }

    book.quantity -= quantity;
    await book.save();
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: 'Failed to sell book' });
  }
});

app.post('/api/upload-file', uploader.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, msg: 'No file uploaded!' });
    }

    // Upload file to Cloudinary
    const upload = await uploadFileToCloudinary(req.file.buffer);

    // Save file URL in the database
    const store = new Store({
      file_url: upload.secure_url,
    });
    const record = await store.save();

    res.status(200).json({ success: true, msg: 'File uploaded successfully!', data: record });
  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start the app
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});
