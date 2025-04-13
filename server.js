const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const multer = require('multer');
const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'https://boxdome-app.onrender.com'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect('mongodb+srv://bobbydevarapu:Boxdome123@cluster0.x5z2v.mongodb.net/boxdome?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: 'https://via.placeholder.com/80' },
    joinDate: { type: Date, default: Date.now },
    role: { type: String, default: 'user' }
});
const User = mongoose.model('User', userSchema);

// Wishlist Schema
const wishlistSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    movieId: { type: Number, required: true },
    movieTitle: { type: String, required: true },
    movieImg: { type: String, required: true }
});
const Wishlist = mongoose.model('Wishlist', wishlistSchema);

// Watch Later Schema
const watchLaterSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    movieId: { type: Number, required: true },
    movieTitle: { type: String, required: true },
    movieImg: { type: String, required: true }
});
const WatchLater = mongoose.model('WatchLater', watchLaterSchema);

// Multer Setup for Profile Picture Upload
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Routes
// Signup
app.post('/api/signup', [
    check('username').notEmpty().withMessage('Username is required'),
    check('email').isEmail().withMessage('Valid email is required'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        const token = jwt.sign({ userId: user._id }, 'your_jwt_secret', { expiresIn: '1h' });
        res.status(201).json({ message: 'User created successfully', token });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error during signup' });
    }
});

// Login
app.post('/api/login', [
    check('username').notEmpty().withMessage('Username is required'),
    check('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user._id }, 'your_jwt_secret', { expiresIn: '1h' });
        res.json({ message: 'Login successful', token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Get User Info
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Profile Picture
app.post('/api/update-profile-pic', authenticateToken, upload.single('profilePic'), async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (req.file) {
            const oldProfilePic = user.profilePic;
            const profilePicUrl = `https://boxdome-app.onrender.com/public/uploads/${req.file.filename}`;
            user.profilePic = profilePicUrl;
            await user.save();

            if (oldProfilePic && oldProfilePic.startsWith('https://boxdome-app.onrender.com/public/uploads/')) {
                const filename = oldProfilePic.split('/').pop();
                await unlinkAsync(`./public/uploads/${filename}`).catch(err => console.error('Error deleting old profile pic:', err));
            }

            res.json({ message: 'Profile picture updated', profilePic: profilePicUrl });
        } else {
            res.status(400).json({ message: 'No file uploaded' });
        }
    } catch (error) {
        console.error('Error updating profile pic:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Username/Email
app.post('/api/update-profile', authenticateToken, [
    check('username').notEmpty().withMessage('Username is required'),
    check('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const { username, email } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { email }], _id: { $ne: user._id } });
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already in use' });
        }

        user.username = username;
        user.email = email;
        await user.save();
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Change Password
app.post('/api/change-password', authenticateToken, [
    check('currentPassword').notEmpty().withMessage('Current password is required'),
    check('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const { currentPassword, newPassword } = req.body;
        if (!(await bcrypt.compare(currentPassword, user.password))) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Wishlist Routes
app.get('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        const wishlist = await Wishlist.find({ userId: req.user.userId });
        res.json({ wishlist });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        const { movieId, movieTitle, movieImg } = req.body;
        const existing = await Wishlist.findOne({ userId: req.user.userId, movieId });
        if (existing) return res.status(400).json({ message: 'Movie already in wishlist' });

        const wishlistItem = new Wishlist({ userId: req.user.userId, movieId, movieTitle, movieImg });
        await wishlistItem.save();
        res.json({ message: 'Added to wishlist' });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        const { movieId } = req.body;
        await Wishlist.deleteOne({ userId: req.user.userId, movieId });
        res.json({ message: 'Removed from wishlist' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Watch Later Routes
app.get('/api/watchlater', authenticateToken, async (req, res) => {
    try {
        const watchLater = await WatchLater.find({ userId: req.user.userId });
        res.json({ watchLater });
    } catch (error) {
        console.error('Error fetching watch later:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/watchlater', authenticateToken, async (req, res) => {
    try {
        const { movieId, movieTitle, movieImg } = req.body;
        const existing = await WatchLater.findOne({ userId: req.user.userId, movieId });
        if (existing) return res.status(400).json({ message: 'Movie already in watch later' });

        const watchLaterItem = new WatchLater({ userId: req.user.userId, movieId, movieTitle, movieImg });
        await watchLaterItem.save();
        res.json({ message: 'Added to watch later' });
    } catch (error) {
        console.error('Error adding to watch later:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/watchlater', authenticateToken, async (req, res) => {
    try {
        const { movieId } = req.body;
        await WatchLater.deleteOne({ userId: req.user.userId, movieId });
        res.json({ message: 'Removed from watch later' });
    } catch (error) {
        console.error('Error removing from watch later:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin Routes
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });

        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Contact Route
app.post('/api/contact', async (req, res) => {
    const { username, email, message } = req.body;
    try {
        // Here you would typically save to a database or send an email
        console.log('Contact form submission:', { username, email, message });
        res.json({ message: 'Message received successfully' });
    } catch (error) {
        console.error('Error processing contact form:', error);
        res.status(500).json({ message: 'Failed to process contact form' });
    }
});

// Authentication Middleware
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, 'your_jwt_secret', (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = decoded;
        next();
    });
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});