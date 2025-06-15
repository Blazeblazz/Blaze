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

// Initialize orders file when server starts
initializeOrdersFile().catch(console.error);

// Order route handler
app.post('/api/orders', async (req, res) => {
    try {
        const { name, phone, city, productId, productName, productPrice, productImage } = req.body;
        
        if (!name || !phone || !city || !productId || !productName || !productPrice) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Read existing orders
        const orders = await readOrders();
        
        // Create new order
        const newOrder = {
            id: Date.now(),
            name,
            phone,
            city,
            productId,
            productName,
            productPrice,
            productImage,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Add new order
        orders.push(newOrder);
        
        // Save orders
        await writeOrders(orders);
        
        // Send email notification
        await sendOrderNotification(newOrder);
        
        res.status(201).json({ message: 'Order created successfully', order: newOrder });
        
    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({ error: 'Failed to process order' });
    }
});

// Get all orders (for admin)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await readOrders();
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Get single order by ID (for admin)
app.get('/api/orders/:id', async (req, res) => {
    try {
        const orders = await readOrders();
        const order = orders.find(o => o.id === parseInt(req.params.id));
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// Update order status (for admin)
app.patch('/api/orders/:id', async (req, res) => {
    try {
        const orders = await readOrders();
        const order = orders.find(o => o.id === parseInt(req.params.id));
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // Update order status
        order.status = req.body.status || order.status;
        
        // Save updated orders
        await writeOrders(orders);
        
        res.json({ message: 'Order updated successfully', order });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

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
                    <a href="https://blaze-giveaway.onrender.com/admin.html" 
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