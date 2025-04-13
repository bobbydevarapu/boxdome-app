require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const winston = require('winston');

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
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5000',
      'https://boxdome-app.onrender.com',
      undefined // Allow non-origin requests (e.g., curl)
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.static(path.join(__dirname, 'Frontend')));

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload configuration with multer
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Ensure uploads directory exists with error handling
const fs = require('fs');
const ensureUploadsDir = (req, res, next) => {
  try {
    if (!fs.existsSync('./uploads')) {
      fs.mkdirSync('./uploads', { recursive: true });
      logger.info('Created uploads directory');
    }
    next();
  } catch (err) {
    logger.error('Failed to create uploads directory:', { message: err.message, stack: err.stack });
    return res.status(500).json({ message: 'Server error creating uploads directory', error: err.message });
  }
};

// MongoDB connection with reconnection logic
const MONGODB_URI = process.env.MONGODB_URI;
let isMongoConnected = false;

const connectMongo = () => {
  mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => {
    console.log('MongoDB connected successfully to:', MONGODB_URI);
    isMongoConnected = true;
  }).catch(err => {
    logger.error('MongoDB connection error:', {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    isMongoConnected = false;
    // Retry connection after 5 seconds
    setTimeout(connectMongo, 5000);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected, attempting to reconnect...');
    isMongoConnected = false;
    setTimeout(connectMongo, 5000);
  });
};

connectMongo();

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

// Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'X7k9pM2q8vT3yJ5nL6xC4rH8wB9zA2dF1eG3jK7mP4oQ6sI0uR5tY==', { ignoreExpiration: false });
    req.userId = decoded.userId;
    next();
  } catch (err) {
    logger.error('Token verification error:', { message: err.message, stack: err.stack });
    res.status(401).json({ message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' });
  }
};

const validateUserInput = (req, res, next) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: 'All fields are required' });
  if (!/^[a-zA-Z0-9]+$/.test(username)) return res.status(400).json({ message: 'Username must be alphanumeric' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be 6+ characters' });
  next();
};

const checkMongoConnection = (req, res, next) => {
  if (!isMongoConnected) return res.status(503).json({ message: 'Database unavailable, please try again later' });
  next();
};

// Routes
app.post('/api/signup', checkMongoConnection, validateUserInput, async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ message: existingUser.email === email ? 'Email exists' : 'Username exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET || 'X7k9pM2q8vT3yJ5nL6xC4rH8wB9zA2dF1eG3jK7mP4oQ6sI0uR5tY==', { expiresIn: '1h' });
    res.status(201).json({ message: 'User created', token, user: { username, email, profilePic: newUser.profilePic } });
  } catch (err) {
    logger.error('Signup error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/login', checkMongoConnection, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'X7k9pM2q8vT3yJ5nL6xC4rH8wB9zA2dF1eG3jK7mP4oQ6sI0uR5tY==', { expiresIn: '1h' });
    res.json({ message: 'Login successful', token, user: { username: user.username, email: user.email, profilePic: user.profilePic } });
  } catch (err) {
    logger.error('Login error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/api/user', authenticateToken, checkMongoConnection, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ username: user.username, email: user.email, profilePic: user.profilePic });
  } catch (err) {
    logger.error('User info error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/update-profile-pic', authenticateToken, ensureUploadsDir, upload.single('profilePic'), checkMongoConnection, async (req, res) => {
  const profilePic = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : req.body.profilePic;
  if (!profilePic) return res.status(400).json({ message: 'Profile picture required' });
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.profilePic = profilePic;
    await user.save();
    logger.info('Updated profilePic:', { profilePic });
    res.json({ message: 'Profile picture updated', profilePic });
  } catch (err) {
    logger.error('Update profile picture error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/update-profile', authenticateToken, checkMongoConnection, async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) return res.status(400).json({ message: 'Username and email required' });
  if (!/^[a-zA-Z0-9]+$/.test(username)) return res.status(400).json({ message: 'Username must be alphanumeric' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email' });
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const existingUser = await User.findOne({ $or: [{ email }, { username }], _id: { $ne: req.userId } });
    if (existingUser) return res.status(400).json({ message: existingUser.email === email ? 'Email exists' : 'Username exists' });
    user.username = username;
    user.email = email;
    await user.save();
    res.json({ message: 'Profile updated' });
  } catch (err) {
    logger.error('Update profile error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/change-password', authenticateToken, checkMongoConnection, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new passwords required' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be 6+ characters' });
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password incorrect' });
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();
    res.json({ message: 'Password changed' });
  } catch (err) {
    logger.error('Change password error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/wishlist', authenticateToken, checkMongoConnection, async (req, res) => {
  const { movieId, movieTitle, movieImg } = req.body;
  if (!movieId || !movieTitle || !movieImg) return res.status(400).json({ message: 'Movie details required' });
  try {
    const existingItem = await Wishlist.findOne({ userId: req.userId, movieId });
    if (existingItem) return res.status(400).json({ message: 'Movie already in wishlist' });
    const wishlistItem = new Wishlist({ userId: req.userId, movieId, movieTitle, movieImg });
    await wishlistItem.save();
    res.json({ message: 'Added to wishlist' });
  } catch (err) {
    logger.error('Add to wishlist error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/api/wishlist', authenticateToken, checkMongoConnection, async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ userId: req.userId });
    res.json({ wishlist });
  } catch (err) {
    logger.error('Get wishlist error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.delete('/api/wishlist', authenticateToken, checkMongoConnection, async (req, res) => {
  const { movieId } = req.body;
  if (!movieId) return res.status(400).json({ message: 'Movie ID required' });
  try {
    await Wishlist.deleteOne({ userId: req.userId, movieId });
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    logger.error('Remove from wishlist error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/watchlater', authenticateToken, checkMongoConnection, async (req, res) => {
  const { movieId, movieTitle, movieImg } = req.body;
  if (!movieId || !movieTitle || !movieImg) return res.status(400).json({ message: 'Movie details required' });
  try {
    const existingItem = await WatchLater.findOne({ userId: req.userId, movieId });
    if (existingItem) return res.status(400).json({ message: 'Movie already in watch later' });
    const watchLaterItem = new WatchLater({ userId: req.userId, movieId, movieTitle, movieImg });
    await watchLaterItem.save();
    res.json({ message: 'Added to watch later' });
  } catch (err) {
    logger.error('Add to watch later error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/api/watchlater', authenticateToken, checkMongoConnection, async (req, res) => {
  try {
    const watchLater = await WatchLater.find({ userId: req.userId });
    res.json({ watchLater });
  } catch (err) {
    logger.error('Get watch later error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.delete('/api/watchlater', authenticateToken, checkMongoConnection, async (req, res) => {
  const { movieId } = req.body;
  if (!movieId) return res.status(400).json({ message: 'Movie ID required' });
  try {
    await WatchLater.deleteOne({ userId: req.userId, movieId });
    res.json({ message: 'Removed from watch later' });
  } catch (err) {
    logger.error('Remove from watch later error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/contact', checkMongoConnection, async (req, res) => {
  const { username, email, message } = req.body;
  if (!username || !email || !message) return res.status(400).json({ message: 'All fields required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email' });
  try {
    const contactMessage = new Contact({ username, email, message });
    await contactMessage.save();
    res.json({ message: 'Message sent' });
  } catch (err) {
    logger.error('Contact form error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'Frontend', 'index.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'Frontend', 'dashboard.html')));
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'Frontend', 'index.html'));
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});

app.use((err, req, res, next) => {
  logger.error('Server error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    headers: req.headers
  });
  res.status(500).json({ message: 'Something went wrong', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));