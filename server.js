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
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: `Nouvelle commande - BLAZE`,
            html: `
                <h2>Nouvelle commande reçue</h2>
                <p><strong>Nom:</strong> ${order.name}</p>
                <p><strong>Téléphone:</strong> ${order.phone}</p>
                <p><strong>Ville:</strong> ${order.city}</p>
                <p><strong>Produit:</strong> ${order.productName}</p>
                <p><strong>Prix:</strong> ${order.productPrice}€</p>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Email notification sent');
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

// Routes
app.get('/', (req, res) => {
    res.send('BLAZE Order System API');
});

// Get all orders
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await readOrders();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Error reading orders' });
    }
});

// Create new order
app.post('/api/orders', async (req, res) => {
    try {
        const { name, phone, city, productId, productName, productPrice, productImage } = req.body;
        
        if (!name || !phone || !city || !productId || !productName || !productPrice || !productImage) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const orders = await readOrders();
        const order = {
            id: Date.now(),
            name,
            phone,
            city,
            productId,
            productName,
            productPrice,
            productImage,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };

        orders.push(order);
        await writeOrders(orders);
        await sendOrderNotification(order);

        res.status(201).json(order);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Error creating order' });
    }
});

// Update order status
app.patch('/api/orders/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const orders = await readOrders();
        const orderIndex = orders.findIndex(order => order.id === parseInt(req.params.id));

        if (orderIndex === -1) {
            return res.status(404).json({ error: 'Order not found' });
        }

        orders[orderIndex].status = status;
        orders[orderIndex].updatedAt = new Date().toISOString();
        await writeOrders(orders);

        res.json(orders[orderIndex]);
    } catch (error) {
        res.status(500).json({ error: 'Error updating order' });
    }
});

// Delete order
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const orders = await readOrders();
        const orderIndex = orders.findIndex(order => order.id === parseInt(req.params.id));

        if (orderIndex === -1) {
            return res.status(404).json({ error: 'Order not found' });
        }

        orders.splice(orderIndex, 1);
        await writeOrders(orders);
        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting order' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    initializeOrdersFile();
});