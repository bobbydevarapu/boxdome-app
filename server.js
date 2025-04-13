require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // Added for file uploads
const winston = require('winston'); // Added for logging

const app = express();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5000', 'https://boxdome-app.herokuapp.com'],
  credentials: true
}));
app.use(express.static(path.join(__dirname, 'Frontend'))); // Serve static files from 'Frontend'

// Add static serving for uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // New addition for profile pictures

// File upload configuration with multer
const storage = multer.diskStorage({
  destination: './uploads/', // Directory to store uploaded files
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // Unique filename with timestamp
  }
});
const upload = multer({ storage });

// Ensure uploads directory exists (add this middleware)
const fs = require('fs');
const ensureUploadsDir = (req, res, next) => {
  if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
  }
  next();
};

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
let isMongoConnected = false;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('MongoDB connected successfully to:', MONGODB_URI);
    isMongoConnected = true;
  })
  .catch(err => {
    logger.error('MongoDB connection error:', {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    isMongoConnected = false;
  });

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePic: { type: String, default: 'https://via.placeholder.com/40' },
});

const User = mongoose.model('User', userSchema);

// Wishlist Schema
const wishlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  movieId: { type: String, required: true },
  movieTitle: { type: String, required: true },
  movieImg: { type: String, required: true },
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

// Watch Later Schema
const watchLaterSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  movieId: { type: String, required: true },
  movieTitle: { type: String, required: true },
  movieImg: { type: String, required: true },
});

const WatchLater = mongoose.model('WatchLater', watchLaterSchema);

// Contact Schema
const contactSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Contact = mongoose.model('Contact', contactSchema);

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'X7k9pM2q8vT3yJ5nL6xC4rH8wB9zA2dF1eG3jK7mP4oQ6sI0uR5tY==');
    req.userId = decoded.userId;
    next();
  } catch (err) {
    logger.error('Token verification error:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Input validation middleware
const validateUserInput = (req, res, next) => {
  const { username, email, password } = req.body;
  console.log('Received signup data:', { username, email, password });
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return res.status(400).json({ message: 'Username must be alphanumeric' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }
  next();
};

// Middleware to check MongoDB connection
const checkMongoConnection = (req, res, next) => {
  if (!isMongoConnected) {
    logger.error('Database unavailable during request:', new Date());
    return res.status(503).json({ message: 'Database is unavailable. Please try again later.' });
  }
  next();
};

// Signup Route
app.post('/api/signup', checkMongoConnection, validateUserInput, async (req, res) => {
  const { username, email, password } = req.body;
  console.log('Signup request:', req.body);
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    console.log('Existing user check:', existingUser);
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ message: 'Username already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    console.log('User created successfully:', { username, email });

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET || 'X7k9pM2q8vT3yJ5nL6xC4rH8wB9zA2dF1eG3jK7mP4oQ6sI0uR5tY==', { expiresIn: '1h' });
    res.status(201).json({ message: 'User created successfully', token, user: { username: newUser.username, email: newUser.email, profilePic: newUser.profilePic } });
  } catch (err) {
    logger.error('Signup error:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      name: err.name
    });
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login request:', req.body);
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ username });
    console.log('User found:', user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'X7k9pM2q8vT3yJ5nL6xC4rH8wB9zA2dF1eG3jK7mP4oQ6sI0uR5tY==', { expiresIn: '1h' });
    res.json({
      message: 'Login successful',
      token,
      user: { username: user.username, email: user.email, profilePic: user.profilePic },
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// User Info Route
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (err) {
    logger.error('User info error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Update Profile Picture Route (Updated to handle file uploads)
app.post('/api/update-profile-pic', authenticateToken, ensureUploadsDir, upload.single('profilePic'), async (req, res) => {
  const profilePic = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : req.body.profilePic;
  if (!profilePic) {
    return res.status(400).json({ message: 'Profile picture URL or file is required' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.profilePic = profilePic;
    await user.save();
    logger.info('Updated profilePic in DB:', { profilePic }); // Debug log
    res.json({ message: 'Profile picture updated successfully', profilePic });
  } catch (err) {
    logger.error('Update profile picture error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Update Profile Route
app.post('/api/update-profile', authenticateToken, async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) {
    return res.status(400).json({ message: 'Username and email are required' });
  }
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return res.status(400).json({ message: 'Username must be alphanumeric' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
      _id: { $ne: req.userId },
    });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ message: 'Username already exists' });
      }
    }

    user.username = username;
    user.email = email;
    await user.save();
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    logger.error('Update profile error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Change Password Route
app.post('/api/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    logger.error('Change password error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Add to Wishlist Route
app.post('/api/wishlist', authenticateToken, async (req, res) => {
  const { movieId, movieTitle, movieImg } = req.body;
  if (!movieId || !movieTitle || !movieImg) {
    return res.status(400).json({ message: 'Movie ID, title, and image are required' });
  }

  try {
    const existingItem = await Wishlist.findOne({ userId: req.userId, movieId });
    if (existingItem) {
      return res.status(400).json({ message: 'Movie already in wishlist' });
    }

    const wishlistItem = new Wishlist({ userId: req.userId, movieId, movieTitle, movieImg });
    await wishlistItem.save();
    res.json({ message: 'Added to wishlist' });
  } catch (err) {
    logger.error('Add to wishlist error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Get Wishlist Route
app.get('/api/wishlist', authenticateToken, async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ userId: req.userId });
    res.json({ wishlist });
  } catch (err) {
    logger.error('Get wishlist error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Remove from Wishlist Route
app.delete('/api/wishlist', authenticateToken, async (req, res) => {
  const { movieId } = req.body;
  if (!movieId) {
    return res.status(400).json({ message: 'Movie ID is required' });
  }

  try {
    await Wishlist.deleteOne({ userId: req.userId, movieId });
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    logger.error('Remove from wishlist error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Add to Watch Later Route
app.post('/api/watchlater', authenticateToken, async (req, res) => {
  const { movieId, movieTitle, movieImg } = req.body;
  if (!movieId || !movieTitle || !movieImg) {
    return res.status(400).json({ message: 'Movie ID, title, and image are required' });
  }

  try {
    const existingItem = await WatchLater.findOne({ userId: req.userId, movieId });
    if (existingItem) {
      return res.status(400).json({ message: 'Movie already in watch later' });
    }

    const watchLaterItem = new WatchLater({ userId: req.userId, movieId, movieTitle, movieImg });
    await watchLaterItem.save();
    res.json({ message: 'Added to watch later' });
  } catch (err) {
    logger.error('Add to watch later error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Get Watch Later Route
app.get('/api/watchlater', authenticateToken, async (req, res) => {
  try {
    const watchLater = await WatchLater.find({ userId: req.userId });
    res.json({ watchLater });
  } catch (err) {
    logger.error('Get watch later error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Remove from Watch Later Route
app.delete('/api/watchlater', authenticateToken, async (req, res) => {
  const { movieId } = req.body;
  if (!movieId) {
    return res.status(400).json({ message: 'Movie ID is required' });
  }

  try {
    await WatchLater.deleteOne({ userId: req.userId, movieId });
    res.json({ message: 'Removed from watch later' });
  } catch (err) {
    logger.error('Remove from watch later error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Contact Form Submission Route
app.post('/api/contact', async (req, res) => {
  const { username, email, message } = req.body;
  if (!username || !email || !message) {
    return res.status(400).json({ message: 'Username, email, and message are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    const contactMessage = new Contact({ username, email, message });
    await contactMessage.save();
    res.json({ message: 'Message sent successfully' });
  } catch (err) {
    logger.error('Contact form error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
  }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'index.html'));
});

// Serve dashboard.html for the dashboard route
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'dashboard.html'));
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', {
    message: err.message,
    stack: err.stack
  });
  res.status(500).json({ message: 'Something went wrong on the server', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));