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
    origin: function(origin, callback) {
        // Allow requests from mobile browsers
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3000',
            'https://blazeblazz.github.io',
            'https://blaze-giveaway.onrender.com',
            'https://blazeblazz.github.io/Blaze',
            // Add mobile app URLs if needed
            'https://m.blaze-giveaway.onrender.com',
            'https://www.blaze-giveaway.onrender.com'
        ];
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
    credentials: true,
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
}));

// Add preflight handler
app.options('*', cors());

app.use(express.json());
app.use(express.static('public'));

// Orders file path
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const BACKUP_ORDERS_FILE = path.join(__dirname, 'orders_backup.json');

// Create orders.json if it doesn't exist
try {
    await fs.access(ORDERS_FILE);
} catch (error) {
    await fs.writeFile(ORDERS_FILE, '[]');
}

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

// Read orders with backup
async function readOrders() {
    try {
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        const orders = JSON.parse(data);
        // Create backup if it doesn't exist
        try {
            await fs.access(BACKUP_ORDERS_FILE);
        } catch (error) {
            await fs.writeFile(BACKUP_ORDERS_FILE, data);
        }
        return orders;
    } catch (error) {
        console.error('Error reading orders:', error);
        // Try to restore from backup if available
        try {
            const backupData = await fs.readFile(BACKUP_ORDERS_FILE, 'utf8');
            const orders = JSON.parse(backupData);
            await fs.writeFile(ORDERS_FILE, backupData);
            return orders;
        } catch (backupError) {
            console.error('Error restoring from backup:', backupError);
            return [];
        }
    }
}

// Write orders with backup
async function writeOrders(orders) {
    try {
        const data = JSON.stringify(orders, null, 2);
        // Write to backup first
        await fs.writeFile(BACKUP_ORDERS_FILE, data);
        // Then write to main file
        await fs.writeFile(ORDERS_FILE, data);
        return true;
    } catch (error) {
        console.error('Error writing orders:', error);
        return false;
    }
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        const orders = await readOrders();
        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Order not found');
        }

        const updatedOrder = {
            ...orders[orderIndex],
            status: newStatus,
            updatedAt: new Date().toISOString()
        };

        orders[orderIndex] = updatedOrder;
        const success = await writeOrders(orders);
        
        if (success) {
            // Send email notification for status change
            await sendOrderNotification(updatedOrder);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error updating order status:', error);
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

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000; // 5 seconds

    async function sendWithRetry(retryCount = 0) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.ADMIN_EMAIL,
                subject: `Commande mise à jour - ${order.productName}`,
                text: `Mise à jour de commande:\n\n` +
                      `Nom: ${order.name}\n` +
                      `Téléphone: ${order.phone}\n` +
                      `Ville: ${order.city}\n` +
                      `Produit: ${order.productName}\n` +
                      `Prix: ${order.productPrice}€\n` +
                      `ID de commande: ${order.id}\n` +
                      `Status: ${order.status}\n` +
                      `Date: ${new Date(order.timestamp).toLocaleString()}\n` +
                      `Dernière mise à jour: ${new Date(order.updatedAt).toLocaleString()}`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                        Commande mise à jour
                    </h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                        <p><strong>Informations du client:</strong></p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Nom: ${order.name}</li>
                            <li>Téléphone: ${order.phone}</li>
                            <li>Ville: ${order.city}</li>
                        </ul>
                        <p><strong>Produit:</strong></p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Nom: ${order.productName}</li>
                            <li>Prix: ${order.productPrice}€</li>
                        </ul>
                        <p><strong>Détails de la commande:</strong></p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>ID: ${order.id}</li>
                            <li>Status: ${order.status}</li>
                            <li>Date: ${new Date(order.timestamp).toLocaleString()}</li>
                            <li>Dernière mise à jour: ${new Date(order.updatedAt).toLocaleString()}</li>
                        </ul>
                    </div>
                </div>
                `,
            };

            await transporter.sendMail(mailOptions);
            console.log('Email notification sent successfully');
            return true;
        } catch (error) {
            console.error(`Error sending email notification (attempt ${retryCount + 1}):`, error);
            if (retryCount < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return sendWithRetry(retryCount + 1);
            }
            throw error;
        }
    });
}