// liveScore.js
// Live Cricket Score Fetcher
// This script fetches live cricket scores from Cricbuzz API via RapidAPI

const axios = require('axios');
require('dotenv').config(); // For loading API key from .env file

// Configuration options
const DEFAULT_MATCH_ID = '41881'; // Default match ID to fetch data for
const REFRESH_INTERVAL = 30000; // Refresh every 60 seconds

// Fetch list of active/recent matches
async function getActiveMatches() {
  try {
    const response = await axios.get("https://cricbuzz-cricket.p.rapidapi.com/matches/v1/recent", {
      headers: {
        'X-RapidAPI-Host': 'cricbuzz-cricket.p.rapidapi.com',
        'X-RapidAPI-Key': process.env.RAPID_API_KEY
      }
    });

    return response.data.typeMatches.flatMap(type =>
      type.seriesMatches.flatMap(series =>
        series.seriesAdWrapper.matches.map(match => ({
          id: match.matchInfo.matchId,
          teams: `${match.matchInfo.team1.teamName} vs ${match.matchInfo.team2.teamName}`,
          type: match.matchInfo.matchFormat,
          status: match.matchInfo.status
        }))
      )
    );
  } catch (error) {
    console.error('Error fetching matches:', error.message);
    return [];
  }
}

// Fetch live cricket score by match ID
async function getLiveCricketScore(matchId = DEFAULT_MATCH_ID) {
  try {
    const response = await axios.get(`https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/${matchId}/comm`, {
      headers: {
        'X-RapidAPI-Host': 'cricbuzz-cricket.p.rapidapi.com',
        'X-RapidAPI-Key': process.env.RAPID_API_KEY || 'invalid_key'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching cricket score:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Display a simplified match score
function displaySimplifiedScore(data) {
  if (!data || !data.matchHeader || !data.miniscore) {
    console.log('No match data available');
    return;
  }

  const match = data.matchHeader;
  const miniscore = data.miniscore;
  const innings = miniscore.matchScoreDetails?.inningsScoreList || [];
  //const bowl=miniscore.matchScoreDetails?.matchTeamInfo ||[];
  const team1 = match.team1;
  const team2 = match.team2;

  // Get the current batting team name from miniscore
  const currentBatTeamName = miniscore.batTeam?.batTeamName;
  const bowlingTeam = (currentBatTeamName === team1.name) ? team1.name: team2.name;
const team1Innings = innings.find(inning => inning.batTeamId === team1.id);
const team2Innings = innings.find(inning => inning.batTeamId === team2.id);

  const isMatchComplete = match.status?.toLowerCase().includes('won');
  const isFirstInningsOnly = innings.length === 1;
  const isSecondInningsLive = innings.length === 2 && !isMatchComplete;

  console.log(`Match: ${team1.name} vs ${team2.name}`);
  console.log(`Status: ${match.status || 'Live match in progress'}`);
  console.log('----------------------------------------');

  // 🏁 Case 1: Match Complete
  if (isMatchComplete) {
    console.log(`Match Complete:`);
    if (team1Innings) console.log(`${team1.name}: ${team1Innings.score}/${team1Innings.wickets} in ${team1Innings.overs} overs`);
    if (team2Innings) console.log(`${team2.name}: ${team2Innings.score}/${team2Innings.wickets} in ${team2Innings.overs} overs`);
  }

  // 🏏 Case 2: First Innings in Progress
  else if (isFirstInningsOnly) {
    const currentInnings = innings[0];
    
    console.log(`${currentInnings.batTeamName}: ${currentInnings.score}/${currentInnings.wickets} (Currently batting)`);
    if (miniscore.overs) console.log(`Overs: ${miniscore.overs} (${bowlingTeam})`);
  }

  // 🔁 Case 3: Second Innings in Progress
  else if (isSecondInningsLive) {
    if (team1Innings) console.log(`${team1.name}: ${team1Innings.score}/${team1Innings.wickets} in ${team1Innings.overs} overs`);
    if (team2Innings) {
      const currentLabel = team2Innings.batTeamName === currentBatTeamName ? ' (Currently batting)' : '';
      console.log(`${team2.name}: ${team2Innings.score}/${team2Innings.wickets} in ${team2Innings.overs} overs${currentLabel}`);
    }
    if (team2Innings.score) console.log(`Target: ${team2Innings.score}`);
    
    if (miniscore.overs) console.log(`Overs: ${miniscore.overs}`);
  }

  // 🕓 Timestamp
  // console.log('\n--- Updated at:', new Date().toLocaleTimeString(), '---\n');
}

// Start polling for live score updates
function startLiveUpdates(matchId) {
  console.log(`Starting live score updates for match ID: ${matchId}`);
  // Initial fetch
  getLiveCricketScore(matchId).then(displaySimplifiedScore);

  // Repeated fetch
  const intervalId = setInterval(() => {
    getLiveCricketScore(matchId).then(data => {
      process.stdout.write('\x1Bc');
      displaySimplifiedScore(data);
    });
  }, REFRESH_INTERVAL);

  // Graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.log('\nStopping live score updates');
    process.exit();
  });
}

// Parse CLI arguments
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  return args.length > 0 ? args[0] : DEFAULT_MATCH_ID;
}

// Main execution
const matchId = parseCommandLineArgs();
startLiveUpdates(matchId);

// Uncomment to test fetching recent matches
 //getActiveMatches().then(matches => console.table(matches));