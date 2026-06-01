require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const os = require('os');

const PORT = process.env.PORT || 4600;
const MONGO_URI = process.env.MONGO_URI;

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '0.0.0.0';
}

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log('Connected to MongoDB');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on http://localhost:${PORT}`);
            console.log(`Server is running on http://${getLocalIP()}:${PORT} (Local Network)`);
        });
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });
