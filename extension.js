// extension.js
const vscode = require('vscode');
const axios = require('axios');
require('dotenv').config(); // For loading API key from .env file

// Configuration options
const DEFAULT_MATCH_ID = '41881'; // Default match ID to fetch data for
let statusBarItem;
let currentMatchId = DEFAULT_MATCH_ID;
let refreshIntervalId = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Congratulations, your extension "live-cricket-score" is now active!');
  
  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'live-cricket-score.showDetailedScore';
  statusBarItem.tooltip = 'Click to show detailed cricket score';
  statusBarItem.text = '$(symbol-event) Cricket Score';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('live-cricket-score.showScore', showLiveCricketScore),
    vscode.commands.registerCommand('live-cricket-score.showDetailedScore', showDetailedLiveCricketScore),
    vscode.commands.registerCommand('live-cricket-score.selectMatch', selectCricketMatch),
    vscode.commands.registerCommand('live-cricket-score.startAutoRefresh', startAutoRefresh),
    vscode.commands.registerCommand('live-cricket-score.stopAutoRefresh', stopAutoRefresh)
  );
  
  // Check if auto-refresh is enabled in settings
  const config = vscode.workspace.getConfiguration('liveCricketScore');
  if (config.get('autoRefreshOnStartup')) {
    startAutoRefresh();
  }
  
  // Show initial message to guide users
  vscode.window.showInformationMessage('Live Cricket Score extension is active! Use the command palette and type "Cricket:" to see available commands.');
}

// Fetch list of active/recent matches
async function getActiveMatches() {
  try {
    // Get API key first
    const apiKey = await getApiKey();
    if (!apiKey) {
      vscode.window.showErrorMessage('API key is required to fetch cricket matches');
      return [];
    }
    
    const response = await axios.get("https://cricbuzz-cricket.p.rapidapi.com/matches/v1/recent", {
      headers: {
        'X-RapidAPI-Host': 'cricbuzz-cricket.p.rapidapi.com',
        'X-RapidAPI-Key': apiKey
      }
    });

    // Handle the case where the response structure might be different
    const typeMatches = response.data.typeMatches || [];
    
    return typeMatches.flatMap(type => {
      const seriesMatches = type.seriesMatches || [];
      return seriesMatches.flatMap(series => {
        // Safely access the matches array
        const matches = series.seriesAdWrapper?.matches || [];
        return matches
  .filter(match => {
    const status = match.matchInfo?.status?.toLowerCase();
    return status && (status.includes('live') || status.includes('day') || status.includes('innings') || status.includes('in progress'));
  })
  .map(match => ({
    id: match.matchInfo.matchId,
    teams: `${match.matchInfo.team1.teamName} vs ${match.matchInfo.team2.teamName}`,
    type: match.matchInfo.matchFormat,
    status: match.matchInfo.status
  }));

      });
    });
  } catch (error) {
    console.error('Error fetching matches:', error.message);
    vscode.window.showErrorMessage('Error fetching cricket matches. Check your API key and internet connection.');
    return [];
  }
}

// Get API key from settings or prompt user
async function getApiKey() {
  const config = vscode.workspace.getConfiguration('liveCricketScore');
  let apiKey = config.get('rapidApiKey');
  
  if (!apiKey) {
    // Try to get from .env if available during development
    if (process.env.RAPID_API_KEY) {
      return process.env.RAPID_API_KEY;
    }
    
    // Prompt user for API key 
    apiKey = await vscode.window.showInputBox({
      placeHolder: 'Enter your RapidAPI key',
      prompt: 'API key is required to fetch cricket scores. Get one from RapidAPI.',
      ignoreFocusOut: true
    });
    
    // Save the API key if provided
    if (apiKey) {
      await config.update('rapidApiKey', apiKey, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('API key saved');
    } else {
      vscode.window.showWarningMessage('API key is required for Live Cricket Score extension');
    }
  }
  
  return apiKey;
}

// Fetch live cricket score by match ID
async function getLiveCricketScore(matchId = currentMatchId) {
  try {
    // Get API key first
    const apiKey = await getApiKey();
    if (!apiKey) {
      vscode.window.showErrorMessage('API key is required to fetch cricket scores');
      return null;
    }
    
    const response = await axios.get(`https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/${matchId}/comm`, {
      headers: {
        'X-RapidAPI-Host': 'cricbuzz-cricket.p.rapidapi.com',
        'X-RapidAPI-Key': apiKey
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching cricket score:', error.message);
    vscode.window.showErrorMessage('Error fetching cricket score. Check your API key and internet connection.');
    return null;
  }
}

// Format score for status bar - short form
function formatStatusBarScore(data) {
  if (!data || !data.matchHeader || !data.miniscore) {
    return '$(symbol-event) No match data';
  }

  const match = data.matchHeader;
  const miniscore = data.miniscore;
  const innings = miniscore.matchScoreDetails?.inningsScoreList || [];
  
  // Get short team names (using initials if needed)
  const team1Short = getShortTeamName(match.team1.name);
  const team2Short = getShortTeamName(match.team2.name);
  
  // Use a cricket ball emoji to indicate this is cricket
  let statusText = '$(symbol-event) ';
  
  if (!innings || innings.length === 0) {
    return `${statusText}${team1Short} vs ${team2Short} | Match yet to start`;
  }
  
  try {
    const team1Innings = innings.find(inning => inning.batTeamId === match.team1.id);
    const team2Innings = innings.find(inning => inning.batTeamId === match.team2.id);
    
    // Format the text based on match state
    if (team1Innings) {
      statusText += `${team1Short} ${team1Innings.score}/${team1Innings.wickets}`;
    }
    
    if (team2Innings) {
      statusText += ` | ${team2Short} ${team2Innings.score}/${team2Innings.wickets}`;
    } else if (team1Innings) {
      statusText += ` | ${team2Short} yet to bat`;
    }
    
    return statusText;
  } catch (error) {
    console.error('Error formatting status bar score:', error);
    return `${statusText}${team1Short} vs ${team2Short}`;
  }
}

// Get short team name (abbreviation or first 3 chars)
function getShortTeamName(teamName) {
  // Common cricket team abbreviations
  const abbreviations = {
    'India': 'IND',
    'Australia': 'AUS',
    'England': 'ENG',
    'Pakistan': 'PAK',
    'South Africa': 'SA',
    'New Zealand': 'NZ',
    'West Indies': 'WI',
    'Sri Lanka': 'SL',
    'Bangladesh': 'BAN',
    'Zimbabwe': 'ZIM',
    'Afghanistan': 'AFG'
  };
  
  return abbreviations[teamName] || teamName.substring(0, 3).toUpperCase();
}

// Format detailed score info for WebView panel
function formatDetailedScore(data) {
  if (!data || !data.matchHeader || !data.miniscore) {
    return '<h2>No match data available</h2>';
  }

  const match = data.matchHeader;
  const miniscore = data.miniscore;
  const innings = miniscore.matchScoreDetails?.inningsScoreList || [];
  const team1 = match.team1;
  const team2 = match.team2;

  // Get current batting team
  const currentBatTeamName = miniscore.batTeam?.batTeamName;
  const bowlingTeam = (currentBatTeamName === team1.name) ? team2.name : team1.name;
  const team1Innings = innings.find(inning => inning.batTeamId === team1.id);
  const team2Innings = innings.find(inning => inning.batTeamId === team2.id);

  const isMatchComplete = match.status?.toLowerCase().includes('won');
  const isFirstInningsOnly = innings.length === 1;
  const isSecondInningsLive = innings.length === 2 && !isMatchComplete;

  // Build HTML content
  let html = `
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', 'Droid Sans', sans-serif; padding: 10px; }
        h1 { font-size: 18px; margin-bottom: 5px; }
        h2 { font-size: 16px; margin-top: 5px; color: #888; }
        .score-card { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .active { background-color: rgba(65, 184, 131, 0.1); border-color: #41b883; }
        .complete { background-color: rgba(66, 153, 225, 0.1); }
        .team-name { font-weight: bold; }
        .status { color: #e56643; font-weight: bold; }
        .target { color: #d946ef; }
        .batsmen-info { margin-top: 10px; }
        .batsman { padding: 2px 0; }
        .timestamp { color: #888; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>${team1.name} vs ${team2.name}</h1>
      <h2 class="status">${match.status || 'Live match in progress'}</h2>
  `;

  // Match Complete
  if (isMatchComplete) {
    html += `<div class="score-card complete">
      <h3>Match Complete</h3>`;
    
    if (team1Innings) {
      html += `<div><span class="team-name">${team1.name}:</span> ${team1Innings.score}/${team1Innings.wickets} in ${team1Innings.overs} overs</div>`;
    }
    
    if (team2Innings) {
      html += `<div><span class="team-name">${team2.name}:</span> ${team2Innings.score}/${team2Innings.wickets} in ${team2Innings.overs} overs</div>`;
    }
    
    html += `</div>`;
  }
  // First Innings in Progress
  else if (isFirstInningsOnly) {
    const currentInnings = innings[0];
    
    html += `<div class="score-card active">
      <div><span class="team-name">${currentInnings.batTeamName}:</span> ${currentInnings.score}/${currentInnings.wickets}</div>
      <div>Overs: ${miniscore.overs}</div>`;
    
    // Add batsmen info if available
    if (miniscore.batsmanStriker) {
      html += `<div class="batsmen-info">
        <div class="batsman">${miniscore.batsmanStriker.batName}: ${miniscore.batsmanStriker.batRuns} (${miniscore.batsmanStriker.batBalls}) *</div>
        <div class="batsman">${miniscore.batsmanNonStriker.batName}: ${miniscore.batsmanNonStriker.batRuns} (${miniscore.batsmanNonStriker.batBalls})</div>
      </div>`;
    }
    
    html += `</div>
    
    <div class="score-card">
      <div><span class="team-name">${bowlingTeam}</span> yet to bat</div>
    </div>`;
  }
  // Second Innings in Progress
  else if (isSecondInningsLive) {
    html += `<div class="score-card">`;
    
    if (team1Innings) {
      html += `<div><span class="team-name">${team1.name}:</span> ${team1Innings.score}/${team1Innings.wickets} in ${team1Innings.overs} overs</div>`;
    }
    
    html += `</div>
    
    <div class="score-card active">`;
    
    if (team2Innings) {
      html += `<div><span class="team-name">${team2.name}:</span> ${team2Innings.score}/${team2Innings.wickets}</div>
      <div>Overs: ${miniscore.overs}</div>
      <div class="target">Target: ${team1Innings.score + 1}</div>`;
      
      // Add batsmen info if available
      if (miniscore.batsmanStriker) {
        html += `<div class="batsmen-info">
          <div class="batsman">${miniscore.batsmanStriker.batName}: ${miniscore.batsmanStriker.batRuns} (${miniscore.batsmanStriker.batBalls}) *</div>
          <div class="batsman">${miniscore.batsmanNonStriker.batName}: ${miniscore.batsmanNonStriker.batRuns} (${miniscore.batsmanNonStriker.batBalls})</div>
        </div>`;
      }
    }
    
    html += `</div>`;
  }

  html += `
      <div class="timestamp">Updated at: ${new Date().toLocaleTimeString()}</div>
    </body>
    </html>`;

  return html;
}

// Command: Show live cricket score in information message
async function showLiveCricketScore() {
  try {
    const data = await getLiveCricketScore();
    if (!data) {
      vscode.window.showInformationMessage('No cricket score data available');
      return;
    }

    // Format simple score for the info message
    const match = data.matchHeader;
    const miniscore = data.miniscore;
    const innings = miniscore.matchScoreDetails?.inningsScoreList || [];
    
    if (innings.length === 0) {
      vscode.window.showInformationMessage(`${match.team1.name} vs ${match.team2.name} - Match yet to start`);
      return;
    }
    
    const team1Innings = innings.find(inning => inning.batTeamId === match.team1.id);
    const team2Innings = innings.find(inning => inning.batTeamId === match.team2.id);
    
    let scoreMessage = `${match.team1.name} vs ${match.team2.name} | `;
    
    if (team1Innings) {
      scoreMessage += `${match.team1.name}: ${team1Innings.score}/${team1Innings.wickets} in ${team1Innings.overs} overs`;
    }
    
    if (team2Innings) {
      scoreMessage += ` | ${match.team2.name}: ${team2Innings.score}/${team2Innings.wickets} in ${team2Innings.overs} overs`;
    }
    
    vscode.window.showInformationMessage(scoreMessage);
    
    // Also update status bar
    updateStatusBar(data);
  } catch (error) {
    vscode.window.showErrorMessage(`Error fetching cricket score: ${error.message}`);
  }
}

// Command: Show detailed live cricket score in webview panel
async function showDetailedLiveCricketScore() {
  try {
    const data = await getLiveCricketScore();
    if (!data) {
      vscode.window.showInformationMessage('No cricket score data available');
      return;
    }

    // Create and show a webview panel
    const panel = vscode.window.createWebviewPanel(
      'cricketScoreDetail', // Identifies the type of the panel
      'Live Cricket Score', // Title of the panel
      vscode.ViewColumn.One, // Editor column to show the panel in
      { enableScripts: true } // Webview options
    );

    // Set HTML content
    panel.webview.html = formatDetailedScore(data);
    
    // Also update status bar
    updateStatusBar(data);
  } catch (error) {
    vscode.window.showErrorMessage(`Error showing detailed cricket score: ${error.message}`);
  }
}

// Command: Select cricket match from active matches
async function selectCricketMatch() {
  try {
    const matches = await getActiveMatches();
    
    if (!matches || matches.length === 0) {
      vscode.window.showInformationMessage('No active cricket matches found');
      return;
    }
    
    // Create match selection items
    const items = matches.map(match => ({
      label: match.teams,
      description: `${match.type} | ${match.status}`,
      matchId: match.id
    }));
    
    // Show quick pick
    const selectedMatch = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a cricket match'
    });
    
    if (selectedMatch) {
      currentMatchId = selectedMatch.matchId;
      vscode.window.showInformationMessage(`Selected match: ${selectedMatch.label}`);
      
      // Update score immediately
      const data = await getLiveCricketScore(currentMatchId);
      updateStatusBar(data);
      
      // If auto-refresh is on, restart it with new match id
      if (refreshIntervalId) {
        stopAutoRefresh();
        startAutoRefresh();
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error selecting cricket match: ${error.message}`);
  }
}

// Update the status bar with score
function updateStatusBar(data) {
  if (!data) {
    statusBarItem.text = '$(symbol-event) No cricket data';
    statusBarItem.show();
    return;
  }
  
  statusBarItem.text = formatStatusBarScore(data);
  statusBarItem.show();
}

// Start auto-refresh of cricket score
function startAutoRefresh() {
  // Clear existing interval if any
  stopAutoRefresh();
  
  // Get refresh interval from settings
  const config = vscode.workspace.getConfiguration('liveCricketScore');
  const refreshInterval = (config.get('refreshInterval') || 30) * 1000; // Convert to milliseconds
  
  // Start new interval
  refreshIntervalId = setInterval(async () => {
    try {
      const data = await getLiveCricketScore(currentMatchId);
      updateStatusBar(data);
    } catch (error) {
      console.error('Error refreshing cricket score:', error.message);
    }
  }, refreshInterval);
  
  vscode.window.showInformationMessage(`Auto-refresh started. Updating every ${refreshInterval/1000} seconds`);
}

// Stop auto-refresh of cricket score
function stopAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
    vscode.window.showInformationMessage('Auto-refresh stopped');
  }
}

// This method is called when your extension is deactivated
function deactivate() {
  // Clean up resources
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
  }
  
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}

module.exports = {
  activate,
  deactivate
};