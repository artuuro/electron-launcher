const { createServer } = require('net');
const socketHandler = require('./socketHandler');

const [host, port, token] = ['0.0.0.0', 1453, process.argv[2]];

const run = async () => {
    try {
        if (token) {
            const server = createServer(socket => socketHandler(socket, token));
        
            server.listen(port, host);

            process.send('READY');
        } else {
            process.send('AUTHENTICATION FAILED');
            process.exit(0);
        }
    } catch (e) {
        console.log(`CONNECTION FAILED`);
        process.exit(0);
    }
}

run();
