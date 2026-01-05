const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    pickupDate: {
        type: Date,
        required: true
    },
    pickupTime: {
        type: String,
        required: true
    },
    serviceType: {
        type: String,
        enum: ['dry-clean', 'wash-fold'],
        required: true
    },
    weight: {
        type: Number,
        required: true,
        min: 1,
        max: 20
    },
    express: {
        type: Boolean,
        default: false
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['wallet', 'card', 'upi'],
        required: true
    },
    status: {
        type: String,
        enum: ['scheduled', 'processing', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Order', orderSchema);