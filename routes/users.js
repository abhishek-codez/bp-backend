const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { body, validationResult } = require('express-validator');

router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/profile', auth, [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().matches(/^[0-9]{10}$/).withMessage('Please enter a valid 10-digit phone number'),
    body('address').optional().notEmpty().withMessage('Address cannot be empty'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const updates = req.body;
        const allowedUpdates = ['name', 'phone', 'address', 'password'];
        const filteredUpdates = {};

        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key) && updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        });

        const user = await User.findById(req.user._id);
        
        if (filteredUpdates.password) {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            filteredUpdates.password = await bcrypt.hash(filteredUpdates.password, salt);
        }

        Object.assign(user, filteredUpdates);
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            message: 'Profile updated successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/add-money', auth, [
    body('amount').isFloat({ min: 100, max: 10000 }).withMessage('Amount must be between ₹100 and ₹10,000'),
    body('paymentMethod').isIn(['card', 'upi', 'netbanking']).withMessage('Invalid payment method')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { amount, paymentMethod } = req.body;

        const user = await User.findById(req.user._id);
        user.walletBalance += amount;
        await user.save();

        const transaction = new Transaction({
            userId: user._id,
            type: 'credit',
            amount,
            description: 'Wallet Top-up',
            paymentMethod
        });
        await transaction.save();

        res.json({
            message: 'Money added successfully',
            newBalance: user.walletBalance
        });

    } catch (error) {
        console.error('Add money error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/transactions', auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(10);

        res.json(transactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;