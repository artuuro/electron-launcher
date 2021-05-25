const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, fork } = require('child_process');
const { download } = require('electron-dl');
const StreamZip = require('node-stream-zip');
const localShortcut = require('electron-localshortcut');
const cacheDir = path.join(__dirname, 'cache');
const clientDir = path.join(__dirname, 'client');
const updateApp = require('update-electron-app');
const icon = path.join(__dirname, 'static', 'assets', 'icon.ico');

let server, win, appIcon, contextMenu, activeDownload;

function createWindow() {
    updateApp({
        updateInterval: '1 hour',
        notifyUser: true,
    });

    win = new BrowserWindow({
        width: 680,
        height: 420,
        resizable: false,
        frame: false,
        movable: true,
        transparent: true,
        devTools: false,
        nodeIntegration: false,
        icon,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    win.loadFile(path.join(__dirname, 'static', 'index.html'));

    appIcon = new Tray(icon);

    contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                win.show();
            }
        },
        {
            label: 'Quit',
            click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    appIcon.setToolTip('ShiroiConnect');
    appIcon.setContextMenu(contextMenu);

    win.on('close', _ => {
        win = false;
    });

    win.on('focus', () => {
        localShortcut.register(win, [
            'CommandOrControl+R',
            'CommandOrControl+Shift+R',
            'CommandOrControl+Shift+I',
            'CommandOrControl+Shift+S',
            'F5'
        ], () => { });
    });

    win.on('blur', () => {
        localShortcut.unregisterAll(win);
    });

    // win.on('minimize', event => {
    //     event.preventDefault()
    //     win.hide();
    // });
};

const checkClientExistence = () => {
    const names = [
        'silkroad.exe',
        'sro_client.exe',
        'patcher.exe',
        'Replacer.exe',
        'Shiroi.ini',
        'SilkCfg.dat',
        'Data.pk2',
        'Map.pk2',
        'Media.pk2',
        'Music.pk2',
        'Particles.pk2',
    ];
    const results = names.map(name => fs.existsSync(path.join(clientDir, name)));
    const missing = results.filter(i => !i);

    return (missing.length == 0);
}

const updateState = state => {
    if (win) win.webContents.send('update:state', state);
};

const closeServer = () => {
    if (activeDownload) {
        console.log(`Cancelling active download...`);
        activeDownload.cancel();
    }

    if (server) {
        server.kill();
        server = false;
        console.log(`Proxy closed..`);
        updateState({
            'SERVER_RUNNING': false,
            'EXTRACTING': false,
            'CLIENT_EXISTS': checkClientExistence(),
        });
    }
};

const unpackClient = async info => {
    if (fs.existsSync(info.path)) {
        updateState({
            'EXTRACTING': true,
            'CLIENT_EXISTS': checkClientExistence(),
        });

        const zip = new StreamZip.async({ file: info.path });

        console.log(`Extraction started...`);

        const count = await zip.extract(null, clientDir);

        console.log(`Extracted ${count} entries...`);

        await zip.close();

        console.log(`Extraction completed...`);

        updateState({
            'EXTRACTING': false,
            'CLIENT_EXISTS': checkClientExistence(),
        });
    }
};

const cleanDir = dir => {
    fs.readdir(dir, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            fs.unlink(path.join(dir, file), err => {
                if (err) throw err;
            });
        }
    });
}

ipcMain.handle('do:check-state', () => {
    updateState({
        'SERVER_RUNNING': (typeof server == 'object'),
        'CLIENT_EXISTS': checkClientExistence(),
    });
});

ipcMain.handle('do:install', async () => {
    try {
        console.log(`Cleaning up...`);
        await Promise.all([
            cleanDir(cacheDir),
            cleanDir(clientDir),
        ]);

        // unpackClient({ path: path.join(cacheDir, 'shiroi-game.zip') });
        console.log(`Downloading client...`);
        await download(win, 'https://api.shiroi.online/dl/sro/shiroi-game.zip', {
            directory: cacheDir,
            onStarted: item => {
                activeDownload = item;

                updateState({
                    'IS_DOWNLOADING': true,
                });
            },
            onProgress: progress => {
                updateState({
                    'DOWNLOAD_PROGRESS': progress,
                });
            },
            onCompleted: async file => {
                updateState({
                    'IS_DOWNLOADING': false,
                    'DOWNLOAD_PROGRESS': false,
                    'CLIENT_EXISTS': true,
                });

                await unpackClient(file);
            }
        });
    } catch (e) {
        console.log(`File download error`, e);
    } finally {
        updateState({
            'IS_DOWNLOADING': false,
            'DOWNLOAD_PROGRESS': false,
        });
    }
});

ipcMain.handle('do:init', (e, token) => {
    if (!server) {
        console.log(`Launching proxy...`);
        server = fork(path.join(__dirname, 'server.js'), [token]);
        server.on('message', message => console.log(`[Proxy]:`, message));
        server.on('SIGTERM', () => {
            closeServer();
        });

        if (server) updateState({
            'SERVER_RUNNING': true,
            'EXTRACTING': false,
            'CLIENT_EXISTS': checkClientExistence(),
        });
    }
});

ipcMain.handle('do:destruct', () => {
    closeServer();
});

ipcMain.handle('do:run-game', () => {
    if (server) {
        console.log(`Launching sro_client.exe...`);
        spawn(path.join(__dirname, 'client', 'sro_client.exe'), [0, '/34', 0, 0]);
    }
});

ipcMain.handle('do:run-launcher', () => {
    if (server) {
        console.log(`Launching silkroad.exe...`);
        spawn(path.join(__dirname, 'client', 'silkroad.exe'), [], {
            cwd: path.join(__dirname, 'client'),
        });
    }
});

ipcMain.handle('do:minimize', () => {
    console.log(`Minimize called...`);
    win.hide();
});

ipcMain.handle('do:exit', () => {
    console.log(`Exit called...`);
    if (activeDownload) {
        console.log(`Cancelling active download...`);
        activeDownload.cancel();
    }
    app.quit();
});



app.on('ready', createWindow);
