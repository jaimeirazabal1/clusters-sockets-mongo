const cluster = require('cluster');
const os = require('os');
const mongoose = require('mongoose');
const express = require('express');
const socketIO = require('socket.io');
const path = require('path');

const numCPUs = os.cpus().length;
const dbUrl = 'mongodb://localhost:27017/mydatabase'; // URL de conexión a tu base de datos MongoDB
const collectionName = 'sensorData'; // Nombre de la colección en tu base de datos

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    // Crear los workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        // Reiniciar el worker en caso de que falle
        cluster.fork();
    });
} else {
    console.log(`Worker ${process.pid} started`);

    // Conexión a la base de datos
    mongoose.connect(dbUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
        .then(() => {
            console.log('Conexión exitosa a MongoDB');

            const db = mongoose.connection;
            const collection = db.collection(collectionName);

            // Crear la aplicación Express
            const app = express();
            const publicPath = path.join(__dirname, 'public');
            app.use(express.static(publicPath));
            // Configurar el servidor HTTP con Express
            const server = app.listen(8080, () => {
                console.log('Servidor Express en ejecución en el puerto 8080');
            });

            // Configurar Socket.IO con el servidor HTTP
            const io = socketIO(server);

            io.on('connection', (socket) => {
                console.log('Nuevo sensor conectado');

                socket.on('message', (data) => {
                    console.log('data', data)
                    // Almacenar los datos en la base de datos
                    collection.insertOne({ data: data }, (err, result) => {
                        if (err) {
                            console.error('Error al insertar datos:', err);
                        } else {
                            console.log('Datos almacenados:', result);
                        }
                    });
                });
            });

            // Ruta inicial para servir el archivo HTML
            app.get('/', (req, res) => {
                res.sendFile(path.join(__dirname, 'index.html'));
            });
        })
        .catch((error) => {
            console.error('Error al conectar a MongoDB:', error);
        });
}
