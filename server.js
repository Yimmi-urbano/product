
const mongoose = require('mongoose');
const app = require('./app');



const PORT = 4600;


mongoose.connect('mongodb+srv://data_user:wY1v50t8fX4lMA85@cluster0.entyyeb.mongodb.net/data-creceidea', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log('Connected to MongoDB');


        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });
