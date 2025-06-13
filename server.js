require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'https://blazeblazz.github.io', 'https://blaze-giveaway.onrender.com'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

// Orders file path
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Verify email configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('Email configuration error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Initialize orders file if it doesn't exist
async function initializeOrdersFile() {
    try {
        await fs.access(ORDERS_FILE);
        console.log('Orders file exists');
    } catch {
        console.log('Creating new orders file');
        await fs.writeFile(ORDERS_FILE, JSON.stringify([]));
    }
}

// Read orders
async function readOrders() {
    try {
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading orders:', error);
        return [];
    }
}

// Write orders
async function writeOrders(orders) {
    try {
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
        console.log('Orders written successfully');
    } catch (error) {
        console.error('Error writing orders:', error);
        throw error;
    }
}

// Send email notification
async function sendOrderNotification(order) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.ADMIN_EMAIL) {
        console.error('Email configuration missing:', {
            hasEmailUser: !!process.env.EMAIL_USER,
            hasEmailPass: !!process.env.EMAIL_PASS,
            hasAdminEmail: !!process.env.ADMIN_EMAIL
        });
        return;
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: 'Nouvelle Commande - Giveaway',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                    Nouvelle Commande Reçue
                </h2>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <p><strong>ID:</strong> ${order.id}</p>
                    <p><strong>Client:</strong> ${order.name}</p>
                    <p><strong>Téléphone:</strong> ${order.phone}</p>
                    <p><strong>Ville:</strong> ${order.city}</p>
                    <p><strong>Produit:</strong> ${order.productName}</p>
                    <p><strong>Prix:</strong> ${order.productPrice} MAD</p>
                    <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                    <p><strong>Statut:</strong> ${order.status}</p>
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <a href="http://localhost:3000/admin.html" 
                       style="background-color: #3498db; color: white; padding: 10px 20px; 
                              text-decoration: none; border-radius: 5px;">
                        Voir dans le panneau d'administration
                    </a>
                </div>
            </div>
        `
    };

    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}