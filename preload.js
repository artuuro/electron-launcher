const { ipcRenderer } = require('electron');
const axios = require('axios');
const moment = require('moment');

const api = axios.create({
    baseURL: 'https://api.shiroi.online/v1'
});

window.addEventListener('DOMContentLoaded', async () => {
    window.shiroiMessaging = ipcRenderer;

    const newFrameParams = `frame=true,autoHideMenuBar=true,nodeIntegration=no,width=1024,height=768,transparent=true`;

    let launchedOnce = false;

    let state = {
        'CLIENT_EXISTS': false,
        'IS_DOWNLOADING': false,
        'DOWNLOAD_PROGRESS': false,
        'SERVER_RUNNING': false,
        'EXTRACTING': false,
    };

    const [
        startButton,
        installButton,
        exitButton,
        trayButton,
        webButton,
        signupButton,
        signinForm,
        newsFrame,
        userFrame,
        welcome,
        balance,
        status,
        logoutButton,
        stateFrame,
        progressFrame,
        news,

    ] = await Promise.all([
        document.getElementById('launch'),
        document.getElementById('install'),
        document.getElementById('exit'),
        document.getElementById('tray'),
        document.getElementById('website'),
        document.getElementById('register'),
        document.getElementById('signin'),
        document.getElementById('news'),
        document.getElementById('user'),
        document.getElementById('welcome'),
        document.getElementById('balance'),
        document.getElementById('status'),
        document.getElementById('logout'),
        document.getElementById('state'),
        document.getElementById('progress'),
        api.get('/news'),

    ]);

    const renderSession = async () => {
        const session = localStorage.getItem('token');

        if (session) {
            const username = localStorage.getItem('username');
            const { data } = await api.get('/credits', {
                headers: {
                    Authorization: `Bearer ${session}`,
                }
            });

            if (data) {
                signinForm.className = 'hidden';

                welcome.innerHTML = `Welcome <b>${username}</b>`;
                balance.innerHTML = `<i class="fa fa-money"></i> ${data.silk_own || 0} Silk`;
                status.innerHTML = `<b>Proxy Ready:<b> <i class="fa ${state.SERVER_RUNNING ? 'fa-check green' : 'fa-close red'}"></i>`;

                installButton.style.display = (
                    state.CLIENT_EXISTS || state.IS_DOWNLOADING || state.EXTRACTING
                ) ? 'none' : 'initial';

                if (state.DOWNLOAD_PROGRESS) {
                    const { percent } = state.DOWNLOAD_PROGRESS;
                    progressFrame.style.display = 'initial';
                    progressFrame.innerHTML = `
                        <i class="fa fa-spinner fa-pulse fa-fw"></i> Downloading game: <b>${(percent * 100).toFixed(2)}%</b>
                    `;
                    logoutButton.style.display = 'none';
                } else if (state.EXTRACTING) {
                    progressFrame.style.display = 'initial';
                    progressFrame.innerHTML = `
                        <i class="fa fa-spinner fa-pulse fa-fw"></i> Game downloaded, unpacking... 
                    `;
                    logoutButton.style.display = 'none';
                } else {
                    logoutButton.style.display = 'initial';
                    progressFrame.style.display = 'none';
                    progressFrame.innerHTML = ``;
                }

                userFrame.className = '';

                ipcRenderer.invoke('do:init', session);
            }

            if (state.CLIENT_EXISTS) startButton.style.display = 'initial';
        } else {
            signinForm.className = '';
            welcome.innerHTML = '';
            balance.innerHTML = '';
            installButton.style.display = 'none';
            userFrame.className = 'hidden';
            progressFrame.style.display = 'none';
            startButton.style.display = 'none';
        }
        // state debug:
        // stateFrame.innerHTML = `<code>${JSON.stringify(state, null, 2)}</code>`;
    };

    startButton.style.display = 'none';
    installButton.style.display = 'none';

    startButton.addEventListener('click', _ => {
        if (launchedOnce) {
            if (confirm('Run another client?')) {
                ipcRenderer.invoke('do:run-game');
            }
        } else {
            ipcRenderer.invoke('do:run-launcher');
            launchedOnce = true;
        }
    });

    installButton.addEventListener('click', _ => {
        if (confirm(`This will download & install game automatically!`)) {
            ipcRenderer.invoke('do:install');
        }
    })

    exitButton.addEventListener('click', _ => {
        ipcRenderer.invoke('do:exit');
    });

    trayButton.addEventListener('click', _ => {
        ipcRenderer.invoke('do:minimize');
    });

    webButton.addEventListener('click', _ => {
        window.open('https://shiroi.online', 'Shiroi Online', newFrameParams);
    });

    signupButton.addEventListener('click', _ => {
        window.open('https://shiroi.online/register', 'Registration', newFrameParams);
    });

    signinForm.addEventListener('submit', async event => {
        event.preventDefault();

        const [
            username,
            password,
        ] = [
                document.getElementById('username'),
                document.getElementById('password'),
            ];

        const values = {
            username: username.value,
            password: password.value,
        };

        try {
            const {
                data: {
                    token,
                }
            } = await api.post('/token', values);

            if (token) {
                localStorage.setItem('token', token);
                localStorage.setItem('username', values.username);

                await renderSession();

                ipcRenderer.invoke('do:init', token);
            }
        } catch (e) {
            alert(`Invalid username or password.\r\nPlease double-check your credentials and then try again!`);
        }
    });

    logoutButton.addEventListener('click', async () => {
        localStorage.clear();
        ipcRenderer.invoke('do:destruct');
        launchedOnce = false;
        await renderSession();
    });

    if (news.data) {
        let html = ``;

        for (let data of news.data) {
            html += `<div class="item"><div class="subject"><span>${moment(data.date).format('DD/MM/YYYY')}</span> <b>${data.subject}</b></div><div class="content">${data.content}</div></div>`;
        }

        newsFrame.innerHTML = html;
    }

    ipcRenderer.on('update:state', async (event, args) => {
        state = {
            ...state,
            ...args,
        };
        await renderSession();
    });

    ipcRenderer.invoke('do:check-state');
});

// create bridge between window & ipcRenderer

const electron = require('electron');

process.once('loaded', () => {
    global.ipcRenderer = electron.ipcRenderer;
});