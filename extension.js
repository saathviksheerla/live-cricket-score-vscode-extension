// extension.js - VS Code Extension for Cricket Score App
const vscode = require('vscode');
const { CricketScraper, CricketService, CricketDisplay } = require('./app');

let cricketService;
let statusBarItem;
let webviewPanel;
let outputChannel;

/**
 * Extension activation function
 */
function activate(context) {
    console.log('Cricket Score extension is now active!');

    // Initialize services
    const scraper = new CricketScraper();
    cricketService = new CricketService(scraper);
    
    // Create output channel
    outputChannel = vscode.window.createOutputChannel('Cricket Scores');
    
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '🏏 Cricket';
    statusBarItem.tooltip = 'Click to view cricket scores';
    statusBarItem.command = 'cricketScore.showMatches';
    statusBarItem.show();

    // Setup event handlers
    setupEventHandlers();

    // Register commands
    const commands = [
        vscode.commands.registerCommand('cricketScore.showMatches', showMatches),
        vscode.commands.registerCommand('cricketScore.selectMatch', selectMatch),
        vscode.commands.registerCommand('cricketScore.refreshMatches', refreshMatches),
        vscode.commands.registerCommand('cricketScore.stopAutoRefresh', stopAutoRefresh),
        vscode.commands.registerCommand('cricketScore.openWebview', openWebview)
    ];

    context.subscriptions.push(statusBarItem, outputChannel, ...commands);
}

/**
 * Setup event handlers for cricket service
 */
function setupEventHandlers() {
    cricketService.on('matchesUpdated', (matches) => {
        outputChannel.appendLine(`\n${CricketDisplay.formatMatchList(matches)}`);
    });

    cricketService.on('matchSelected', (match) => {
        statusBarItem.text = `🏏 ${match.teams[0]?.name || 'Match'} vs ${match.teams[1]?.name || 'Match'}`;
        statusBarItem.tooltip = `Live: ${match.title}`;
        outputChannel.appendLine(`\nAuto-refresh started for: ${match.title}`);
        outputChannel.appendLine(CricketDisplay.formatMatchDetails(match));
        outputChannel.show(true);
    });

    cricketService.on('matchUpdated', (match) => {
        outputChannel.clear();
        outputChannel.appendLine(`[AUTO-REFRESH] Updated at: ${new Date().toLocaleTimeString()}`);
        outputChannel.appendLine(CricketDisplay.formatMatchDetails(match));
        
        // Update status bar with live score
        const team1 = match.teams[0];
        const team2 = match.teams[1];
        if (team1 && team2) {
            const score1 = team1.score ? `${team1.score}` : '';
            const score2 = team2.score ? `${team2.score}` : '';
            statusBarItem.text = `🏏 ${team1.name} ${score1} vs ${team2.name} ${score2}`;
        }
        
        // Update webview if open
        if (webviewPanel) {
            updateWebview(match);
        }
    });

    cricketService.on('error', (error) => {
        outputChannel.appendLine(`Error: ${error.message}`);
        vscode.window.showErrorMessage(`Cricket Score Error: ${error.message}`);
    });
}

/**
 * Show matches in quick pick
 */
async function showMatches() {
    try {
        vscode.window.showInformationMessage('Fetching live cricket matches...');
        
        const initialized = await cricketService.initialize();
        if (!initialized) {
            vscode.window.showErrorMessage('Failed to fetch cricket matches');
            return;
        }

        const matches = cricketService.getAllMatches();
        
        if (matches.length === 0) {
            vscode.window.showInformationMessage('No live matches available');
            return;
        }

        const items = matches.map(match => ({
            label: match.title,
            description: match.statusText,
            detail: `${match.ground} • ${match.series}`,
            matchId: match.id,
            match: match
        }));

        const selectedItem = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a cricket match to follow',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selectedItem) {
            cricketService.selectMatch(selectedItem.matchId);
            
            // Ask if user wants to open webview
            const openWebview = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Open in webview for better viewing experience?'
            });
            
            if (openWebview === 'Yes') {
                await openWebviewCommand();
            }
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Error fetching matches: ${error.message}`);
    }
}

/**
 * Select a specific match
 */
async function selectMatch() {
    const matches = cricketService.getAllMatches();
    
    if (matches.length === 0) {
        await showMatches();
        return;
    }

    const items = matches.map(match => ({
        label: match.title,
        description: match.statusText,
        matchId: match.id
    }));

    const selectedItem = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a match'
    });

    if (selectedItem) {
        cricketService.selectMatch(selectedItem.matchId);
    }
}

/**
 * Refresh matches
 */
async function refreshMatches() {
    try {
        await cricketService.initialize();
        vscode.window.showInformationMessage('Matches refreshed!');
    } catch (error) {
        vscode.window.showErrorMessage(`Error refreshing matches: ${error.message}`);
    }
}

/**
 * Stop auto refresh
 */
function stopAutoRefresh() {
    cricketService.stopAutoRefresh();
    statusBarItem.text = '🏏 Cricket';
    statusBarItem.tooltip = 'Click to view cricket scores';
    vscode.window.showInformationMessage('Auto-refresh stopped');
}

/**
 * Open webview panel
 */
async function openWebviewCommand() {
    if (webviewPanel) {
        webviewPanel.reveal();
        return;
    }

    const match = cricketService.getSelectedMatch();
    if (!match) {
        vscode.window.showWarningMessage('Please select a match first');
        return;
    }

    await openWebview(match);
}

/**
 * Create and show webview
 */
async function openWebview(match) {
    webviewPanel = vscode.window.createWebviewPanel(
        'cricketScore',
        `Cricket: ${match.title}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    webviewPanel.webview.html = getWebviewContent(match);

    // Handle webview disposal
    webviewPanel.onDidDispose(() => {
        webviewPanel = undefined;
    });

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'refresh':
                await refreshMatches();
                break;
            case 'changeMatch':
                await selectMatch();
                break;
            case 'stop':
                stopAutoRefresh();
                break;
        }
    });
}

/**
 * Update webview content
 */
function updateWebview(match) {
    if (webviewPanel) {
        webviewPanel.webview.postMessage({ 
            command: 'update', 
            match: match,
            timestamp: new Date().toLocaleTimeString()
        });
    }
}

/**
 * Generate webview HTML content
 */
function getWebviewContent(match) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cricket Score</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
            }
            .match-header {
                background: var(--vscode-editor-selectionBackground);
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            .match-title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
            .match-series { opacity: 0.7; font-size: 14px; }
            .teams {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 20px;
            }
            .team {
                background: var(--vscode-input-background);
                padding: 12px;
                border-radius: 6px;
                border-left: 4px solid var(--vscode-accent-foreground);
            }
            .team-name { font-weight: bold; margin-bottom: 5px; }
            .team-score { font-size: 16px; color: var(--vscode-terminal-ansiGreen); }
            .match-status {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 8px 12px;
                border-radius: 4px;
                font-weight: bold;
                margin-bottom: 15px;
                display: inline-block;
            }
            .controls {
                display: flex;
                gap: 10px;
                margin-top: 20px;
            }
            .btn {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            }
            .btn:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .last-updated {
                margin-top: 20px;
                opacity: 0.7;
                font-size: 12px;
            }
            .live-indicator {
                background: #ff4444;
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        </style>
    </head>
    <body>
        <div id="content">
            <div class="match-header">
                <div class="match-title">${match.title}</div>
                <div class="match-series">${match.series} • ${match.ground}</div>
            </div>
            
            <div class="match-status">
                ${match.isLive ? '<span class="live-indicator">LIVE</span> ' : ''}
                ${match.statusText}
            </div>
            
            <div class="teams">
                ${match.teams.map(team => `
                    <div class="team">
                        <div class="team-name">${team.longName || team.name}</div>
                        <div class="team-score">${team.score || 'Yet to bat'}</div>
                    </div>
                `).join('')}
            </div>
            
            <div class="controls">
                <button class="btn" onclick="sendMessage('refresh')">Refresh</button>
                <button class="btn" onclick="sendMessage('changeMatch')">Change Match</button>
                <button class="btn" onclick="sendMessage('stop')">Stop Auto-refresh</button>
            </div>
            
            <div class="last-updated" id="lastUpdated">
                Last updated: ${new Date().toLocaleTimeString()}
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            
            function sendMessage(command) {
                vscode.postMessage({ command: command });
            }
            
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'update') {
                    updateContent(message.match, message.timestamp);
                }
            });
            
            function updateContent(match, timestamp) {
                document.getElementById('lastUpdated').textContent = 
                    'Last updated: ' + timestamp;
                // Could add more dynamic updates here
            }
        </script>
    </body>
    </html>`;
}

/**
 * Extension deactivation function
 */
function deactivate() {
    if (cricketService) {
        cricketService.stopAutoRefresh();
    }
    if (webviewPanel) {
        webviewPanel.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};