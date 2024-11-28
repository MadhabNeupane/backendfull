require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

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
}).then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Express setup
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, 'public')));

// Multer setup for file uploads
const uploader = multer({
  storage: multer.diskStorage({}),
  limits: { fileSize: 5 * 1024 * 1024 }, // Set limit to 5 MB
});

// Mongoose Schema and Model for Store
const storeSchema = new mongoose.Schema({
  file_url: { type: String, required: true }
});
const book = mongoose.model('book', bookSchema);

// Cloudinary file upload helper
const uploadFileToCloudinary = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath);
    return result;
  } catch (error) {
    console.log(error.message);
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
    const book = new book({
      file_url: upload.secure_url,
    });
    const record = await book.save();

    res.status(200).json({ success: true, msg: 'File uploaded successfully!', data: record });
  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
});
// Route to fetch all file URLs
app.get('/books', async (req, res) => {
  try {
    const files = await Book.find(); // Fetch all documents from the collection
    res.status(200).json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
});


// Start the app
app.listen(3000, () => {
  console.log('App is running on port 3000');
});
