const { Socket } = require('net');

const remote = {
    host: '138.201.58.79',
    port: 14300,
};

module.exports = (local, token) => {
    const proxy = new Socket();

    proxy.connect({
        host: remote.host,
        port: remote.port,
        onread: {
            buffer: Buffer.alloc(8192),
        },
    });

    console.log(`Connected to ${JSON.stringify(remote)}`);

    // Authenticate:
    proxy.write(
        Buffer.from(
            JSON.stringify({
                c: 0,
                d: token
            })
        )
    );

    // Encoder -> Decoder:
    local.on('data', data => {
        const buffer = Buffer.from(
            JSON.stringify({
                c: 1,
                d: Buffer.from(data),
            })
        );

        proxy.write(buffer);
    });

    // Decoder -> Encoder:
    proxy.on('data', data => local.write(data));

    local.on('error', () => proxy.destroy());
    proxy.on('error', () => local.destroy());
};