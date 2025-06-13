require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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

    try {
        console.log('Attempting to send email to:', process.env.ADMIN_EMAIL);
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
    } catch (error) {
        console.error('Error sending email:', error);
        // Log detailed error information
        if (error.code) {
            console.error('Error code:', error.code);
        }
        if (error.command) {
            console.error('Failed command:', error.command);
        }
        if (error.responseCode) {
            console.error('SMTP response code:', error.responseCode);
        }
        if (error.response) {
            console.error('SMTP response:', error.response);
        }
    }
}

// API Routes
app.post('/api/orders', async (req, res) => {
    try {
        const { name, phone, city, productId, productName, productPrice, productImage } = req.body;

        // Validate required fields
        if (!name || !phone || !city || !productId || !productName || !productPrice) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: 'Veuillez remplir tous les champs obligatoires'
            });
        }

        // Validate phone number format
        const phoneRegex = /^(?:(?:\+|00)212|0)[5-7]\d{8}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                error: 'Invalid phone number',
                details: 'Veuillez entrer un numéro de téléphone marocain valide'
            });
        }

        // Validate name length
        if (name.trim().length < 3) {
            return res.status(400).json({
                error: 'Invalid name',
                details: 'Le nom doit contenir au moins 3 caractères'
            });
        }

        // Validate city length
        if (city.trim().length < 2) {
            return res.status(400).json({
                error: 'Invalid city',
                details: 'La ville doit contenir au moins 2 caractères'
            });
        }

        // Create order object
        const order = {
            id: Date.now().toString(),
            name: name.trim(),
            phone: phone.trim(),
            city: city.trim(),
            productId,
            productName,
            productPrice,
            productImage,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Read existing orders
        let orders = [];
        try {
            const ordersData = await fs.readFile(ORDERS_FILE, 'utf8');
            orders = JSON.parse(ordersData);
        } catch (error) {
            // If file doesn't exist or is empty, start with empty array
            orders = [];
        }

        // Add new order
        orders.push(order);

        // Save orders
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));

        // Send email notification
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: 'Nouvelle commande reçue',
                html: `
                    <h2>Nouvelle commande reçue</h2>
                    <p><strong>ID:</strong> ${order.id}</p>
                    <p><strong>Nom:</strong> ${order.name}</p>
                    <p><strong>Téléphone:</strong> ${order.phone}</p>
                    <p><strong>Ville:</strong> ${order.city}</p>
                    <p><strong>Produit:</strong> ${order.productName}</p>
                    <p><strong>Prix:</strong> ${order.productPrice} MAD</p>
                    <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString('fr-FR')}</p>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log('Order notification email sent successfully');
        } catch (emailError) {
            console.error('Error sending order notification email:', emailError);
            // Don't fail the order if email fails
        }

        res.status(201).json({
            message: 'Order created successfully',
            order
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: 'Une erreur est survenue lors de la création de la commande'
        });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const ordersData = await fs.readFile(ORDERS_FILE, 'utf8');
        const orders = JSON.parse(ordersData);
        res.json(orders);
    } catch (error) {
        console.error('Error reading orders:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: 'Une erreur est survenue lors de la lecture des commandes'
        });
    }
});

app.patch('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                details: 'Statut invalide'
            });
        }

        const ordersData = await fs.readFile(ORDERS_FILE, 'utf8');
        const orders = JSON.parse(ordersData);

        const orderIndex = orders.findIndex(order => order.id === id);
        if (orderIndex === -1) {
            return res.status(404).json({
                error: 'Order not found',
                details: 'Commande non trouvée'
            });
        }

        orders[orderIndex].status = status;
        orders[orderIndex].updatedAt = new Date().toISOString();

        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));

        res.json({
            message: 'Order status updated successfully',
            order: orders[orderIndex]
        });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: 'Une erreur est survenue lors de la mise à jour de la commande'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
    });
});

// Initialize and start server
initializeOrdersFile().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(error => {
    console.error('Failed to start server:', error);
}); 