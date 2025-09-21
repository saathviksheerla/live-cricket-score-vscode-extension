// liveScore.js - Enhanced Cricket Score Fetcher (Fixed)
const axios = require('axios');
require('dotenv').config();

class CricketScoreAPI {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.RAPID_API_KEY;
    this.baseURL = 'https://cricbuzz-cricket.p.rapidapi.com';
    this.headers = {
      'X-RapidAPI-Host': 'cricbuzz-cricket.p.rapidapi.com',
      'X-RapidAPI-Key': this.apiKey
    };
    this.debug = false;
  }

  setDebug(enabled = true) {
    this.debug = enabled;
  }

  debugLog(message, data = null) {
    if (this.debug) {
      console.log(`[DEBUG] ${message}`);
      if (data) {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }

  setApiKey(key) {
    this.apiKey = key;
    this.headers['X-RapidAPI-Key'] = key;
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/matches/v1/recent`, {
        headers: this.headers,
        timeout: 5000
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.status || error.code,
        message: error.message 
      };
    }
  }

  async getMatches() {
    try {
      console.log('Fetching matches...');
      const response = await axios.get(`${this.baseURL}/matches/v1/recent`, {
        headers: this.headers,
        timeout: 10000
      });

      const matches = this.parseMatches(response.data);
      console.log(`Found ${matches.length} matches`);
      return matches;
    } catch (error) {
      console.error('Error fetching matches:', error.message);
      if (error.response?.status === 403) {
        throw new Error('Invalid API key or subscription expired');
      }
      throw new Error(`Failed to fetch matches: ${error.message}`);
    }
  }

  parseMatches(data) {
    const matches = [];
    
    if (!data) return matches;

    try {
      const typeMatches = data.typeMatches || [];
      
      for (const type of typeMatches) {
        if (!type.seriesMatches) continue;
        
        for (const series of type.seriesMatches) {
          let matchList = [];
          
          if (series.seriesAdWrapper?.matches) {
            matchList = series.seriesAdWrapper.matches;
          } else if (series.matches) {
            matchList = series.matches;
          }
          
          for (const match of matchList) {
            const matchInfo = match.matchInfo;
            if (!matchInfo) continue;
            
            matches.push({
              id: matchInfo.matchId,
              team1: matchInfo.team1?.teamName || matchInfo.team1?.name || 'TBD',
              team2: matchInfo.team2?.teamName || matchInfo.team2?.name || 'TBD',
              series: matchInfo.seriesName || series.seriesName || 'Unknown Series',
              format: matchInfo.matchFormat || 'Unknown',
              status: matchInfo.status || 'Unknown',
              venue: matchInfo.venueInfo?.ground || 'Unknown Venue',
              startTime: matchInfo.startDate
            });
          }
        }
      }
    } catch (error) {
      console.error('Error parsing matches:', error);
    }

    return matches;
  }

  // Debug helper - raw API response
  async debugScore(matchId) {
    try {
      console.log(`\n=== DEBUGGING MATCH ${matchId} ===`);
      
      const endpoints = [
        { name: 'commentary', url: `/mcenter/v1/${matchId}/comm` },
        { name: 'scorecard', url: `/mcenter/v1/${matchId}/scard` },
        { name: 'info', url: `/mcenter/v1/${matchId}` }
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`\nTrying ${endpoint.name} endpoint...`);
          const response = await axios.get(`${this.baseURL}${endpoint.url}`, {
            headers: this.headers,
            timeout: 10000
          });
          
          console.log(`SUCCESS: ${endpoint.name} endpoint worked`);
          console.log('Response keys:', Object.keys(response.data));
          
          if (response.data) {
            console.log('\n=== FULL API RESPONSE ===');
            console.log(JSON.stringify(response.data, null, 2));
            return response.data; // Return the data for further inspection
          }
        } catch (error) {
          console.log(`FAILED: ${endpoint.name} endpoint - ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Debug failed:', error.message);
    }
  }

  async getScore(matchId) {
    try {
      console.log(`Fetching score for match ID: ${matchId}`);
      
      let response;
      let endpoint = 'unknown';
      
      try {
        response = await axios.get(`${this.baseURL}/mcenter/v1/${matchId}/comm`, {
          headers: this.headers,
          timeout: 10000
        });
        endpoint = 'commentary';
        this.debugLog('Commentary endpoint response:', response.data);
      } catch (commError) {
        this.debugLog('Commentary endpoint failed:', commError.message);
        
        try {
          response = await axios.get(`${this.baseURL}/mcenter/v1/${matchId}/scard`, {
            headers: this.headers,
            timeout: 10000
          });
          endpoint = 'scorecard';
          this.debugLog('Scorecard endpoint response:', response.data);
        } catch (scardError) {
          this.debugLog('Scorecard endpoint failed:', scardError.message);
          
          response = await axios.get(`${this.baseURL}/mcenter/v1/${matchId}`, {
            headers: this.headers,
            timeout: 10000
          });
          endpoint = 'info';
          this.debugLog('Info endpoint response:', response.data);
        }
      }

      console.log(`Successfully fetched data from ${endpoint} endpoint`);
      return this.parseScore(response.data, matchId);
    } catch (error) {
      console.error(`Error fetching score for match ${matchId}:`, error.message);
      if (error.response?.status === 404) {
        throw new Error('Match not found or ended');
      }
      if (error.response?.status === 403) {
        throw new Error('Invalid API key or subscription expired');
      }
      throw new Error(`Failed to fetch score: ${error.message}`);
    }
  }

  parseScore(data, matchId) {
    if (!data) {
      console.log('No data received from API');
      return null;
    }

    console.log('Parsing score data...');
    console.log('API Response keys:', Object.keys(data));

    // Initialize with basic info
    let score = {
      matchId: matchId,
      status: 'Unknown',
      team1: { id: null, name: 'Team 1', shortName: 'T1' },
      team2: { id: null, name: 'Team 2', shortName: 'T2' },
      innings: [],
      currentBatting: null,
      currentBowling: null,
      currentOver: null,
      batsmen: [],
      isComplete: false,
      isLive: false,
      result: 'Unknown',
      lastUpdated: new Date().toISOString()
    };

    // Try to extract match header information
    let matchHeader = null;
    
    // Look for match header in different locations
    if (data.matchheaders) {
      matchHeader = data.matchheaders;
      console.log('Found matchheaders');
    } else if (data.matchHeader) {
      matchHeader = data.matchHeader;
      console.log('Found matchHeader');
    } else if (data.matchInfo) {
      matchHeader = data.matchInfo;
      console.log('Found matchInfo');
    } else if (data.match) {
      matchHeader = data.match;
      console.log('Found match');
    }

    if (matchHeader) {
      console.log('Match header keys:', Object.keys(matchHeader));
      
      // Extract team information
      if (matchHeader.team1) {
        score.team1 = {
          id: matchHeader.team1.teamid || matchHeader.team1.id || matchHeader.team1.teamId,
          name: matchHeader.team1.teamname || matchHeader.team1.name || matchHeader.team1.teamName || matchHeader.team1.teamSName || 'Team 1',
          shortName: this.getTeamShortName(matchHeader.team1.teamname || matchHeader.team1.name || matchHeader.team1.teamName || matchHeader.team1.teamSName || 'Team 1')
        };
        console.log('Team 1:', score.team1);
      }

      if (matchHeader.team2) {
        score.team2 = {
          id: matchHeader.team2.teamid || matchHeader.team2.id || matchHeader.team2.teamId,
          name: matchHeader.team2.teamname || matchHeader.team2.name || matchHeader.team2.teamName || matchHeader.team2.teamSName || 'Team 2',
          shortName: this.getTeamShortName(matchHeader.team2.teamname || matchHeader.team2.name || matchHeader.team2.teamName || matchHeader.team2.teamSName || 'Team 2')
        };
        console.log('Team 2:', score.team2);
      }

      // Extract match status
      score.status = matchHeader.status || matchHeader.state || 'Unknown';
      score.result = score.status;
      console.log('Status:', score.status);
    }

    // Try to extract score information
    let scoreData = null;
    
    if (data.miniscore) {
      scoreData = data.miniscore;
      console.log('Found miniscore');
    } else if (data.scoreCard) {
      scoreData = data.scoreCard;
      console.log('Found scoreCard');
    } else if (data.score) {
      scoreData = data.score;
      console.log('Found score');
    }

    if (scoreData) {
      console.log('Score data keys:', Object.keys(scoreData));
      
      // Parse innings from miniscore
      if (scoreData.inningsscores && scoreData.inningsscores.inningsscore) {
        const inningsList = scoreData.inningsscores.inningsscore;
        score.innings = inningsList.map(inning => ({
          teamId: inning.batteamid,
          teamName: inning.batteamshortname,
          runs: inning.runs || 0,
          wickets: inning.wickets || 0,
          overs: inning.overs || '0.0',
          isComplete: inning.isdeclared || false
        }));
        console.log(`Parsed ${score.innings.length} innings from inningsscores`);
      }
      // Fallback parsing methods
      else {
        let inningsList = null;
        if (scoreData.matchScoreDetails?.inningsScoreList) {
          inningsList = scoreData.matchScoreDetails.inningsScoreList;
        } else if (scoreData.inningsScoreList) {
          inningsList = scoreData.inningsScoreList;
        } else if (scoreData.innings) {
          inningsList = Array.isArray(scoreData.innings) ? scoreData.innings : [scoreData.innings];
        }

        if (inningsList && Array.isArray(inningsList)) {
          score.innings = inningsList.map(inning => ({
            teamId: inning.batTeamId || inning.teamId || inning.batteamid,
            teamName: inning.batTeamName || inning.teamName || inning.name || inning.batteamshortname,
            runs: inning.score || inning.runs || 0,
            wickets: inning.wickets || 0,
            overs: inning.overs || '0.0',
            isComplete: inning.isDeclared || inning.isComplete || inning.isdeclared || false
          }));
          console.log(`Parsed ${score.innings.length} innings from fallback method`);
        }
      }

      // Parse current batting team
      if (scoreData.batTeam || scoreData.teamdetails) {
        const batTeam = scoreData.batTeam || scoreData.teamdetails;
        score.currentBatting = {
          teamId: batTeam.batTeamId || batTeam.batteamid || batTeam.teamId,
          teamName: batTeam.batTeamName || batTeam.batteamname || batTeam.name
        };
      }

      // Parse current batsmen
      if (scoreData.batsmanstriker || scoreData.batsmanStriker) {
        const striker = scoreData.batsmanstriker || scoreData.batsmanStriker;
        score.batsmen.push({
          name: striker.name || striker.batName,
          runs: striker.runs || striker.batRuns || 0,
          balls: striker.balls || striker.batBalls || 0,
          isStriker: true
        });
      }

      if (scoreData.batsmannonstriker || scoreData.batsmanNonStriker) {
        const nonStriker = scoreData.batsmannonstriker || scoreData.batsmanNonStriker;
        score.batsmen.push({
          name: nonStriker.name || nonStriker.batName,
          runs: nonStriker.runs || nonStriker.batRuns || 0,
          balls: nonStriker.balls || nonStriker.batBalls || 0,
          isStriker: false
        });
      }

      score.currentOver = scoreData.overs || scoreData.currentOver || null;
    }

    // Determine match state
    const status = score.status.toLowerCase();
    score.isComplete = status.includes('won') || status.includes('lost') || 
                       status.includes('tied') || status.includes('draw') || 
                       status.includes('no result') || status.includes('abandoned');
    score.isLive = !score.isComplete && score.innings.length > 0;

    console.log('Final parsed score:', {
      team1: score.team1.name,
      team2: score.team2.name,
      status: score.status,
      inningsCount: score.innings.length,
      isLive: score.isLive,
      isComplete: score.isComplete
    });

    return score;
  }

  getTeamShortName(teamName) {
    if (!teamName) return 'TBD';
    
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
      'Afghanistan': 'AFG',
      'Ireland': 'IRE',
      'Scotland': 'SCO',
      'Netherlands': 'NED',
      'Hong Kong': 'HK',
      'United Arab Emirates': 'UAE',
      'Oman': 'OMA',
      'Barbados Royals': 'BR',
      'Guyana Amazon Warriors': 'GAW',
      'Jamaica Tallawahs': 'JT',
      'St Kitts and Nevis Patriots': 'SNP',
      'Saint Lucia Kings': 'SLK',
      'Trinbago Knight Riders': 'TKR',
      'Antigua and Barbuda Falcons': 'ABF'
    };
    
    // Check for exact match first
    if (abbreviations[teamName]) {
      return abbreviations[teamName];
    }
    
    // Check for partial matches
    for (const [fullName, abbrev] of Object.entries(abbreviations)) {
      if (teamName.includes(fullName)) {
        return abbrev;
      }
    }
    
    // Fallback: create abbreviation from team name
    return teamName.split(' ')
                   .map(word => word.charAt(0))
                   .join('')
                   .toUpperCase()
                   .substring(0, 3);
  }

  formatScore(scoreData) {
    if (!scoreData) return 'No score data available';

    const { team1, team2, innings, status, isComplete, isLive, batsmen, currentOver } = scoreData;
    
    let formatted = `${team1.name} vs ${team2.name}\n`;
    formatted += `Status: ${status}\n`;
    formatted += '-'.repeat(50) + '\n';

    if (innings.length === 0) {
      formatted += 'Match not started or no score data available\n';
      return formatted;
    }

    // Show innings scores
    innings.forEach((inning, index) => {
      const indicator = isLive && index === innings.length - 1 ? ' (Live)' : '';
      formatted += `${inning.teamName}: ${inning.runs}/${inning.wickets} (${inning.overs} ov)${indicator}\n`;
    });

    // Show current batsmen if live
    if (isLive && batsmen.length > 0) {
      formatted += '\nCurrent Partnership:\n';
      batsmen.forEach(batsman => {
        const striker = batsman.isStriker ? ' *' : '';
        formatted += `${batsman.name}: ${batsman.runs} (${batsman.balls})${striker}\n`;
      });
      
      if (currentOver) {
        formatted += `Over: ${currentOver}\n`;
      }
    }

    return formatted;
  }

  // Simple score format for extensions
  getSimpleScore(scoreData) {
    if (!scoreData || scoreData.innings.length === 0) {
      return {
        team1: scoreData?.team1?.shortName || 'T1',
        team2: scoreData?.team2?.shortName || 'T2',
        score1: 'TBD',
        score2: 'TBD',
        status: scoreData?.status || 'Unknown',
        isLive: false
      };
    }

    const team1Innings = scoreData.innings.find(i => i.teamName === scoreData.team1.name || i.teamName === scoreData.team1.shortName);
    const team2Innings = scoreData.innings.find(i => i.teamName === scoreData.team2.name || i.teamName === scoreData.team2.shortName);

    return {
      team1: scoreData.team1.shortName,
      team2: scoreData.team2.shortName,
      score1: team1Innings ? `${team1Innings.runs}/${team1Innings.wickets}` : 'TBD',
      score2: team2Innings ? `${team2Innings.runs}/${team2Innings.wickets}` : 'TBD',
      overs1: team1Innings?.overs || '0.0',
      overs2: team2Innings?.overs || '0.0',
      status: scoreData.status,
      isLive: scoreData.isLive,
      currentOver: scoreData.currentOver
    };
  }
}

// Interactive CLI interface
class CricketCLI {
  constructor() {
    this.api = new CricketScoreAPI();
    this.selectedMatch = null;
  }

  async start() {
    console.clear();
    console.log('Cricket Live Score\n');

    if (!this.api.apiKey) {
      console.error('ERROR: No API key found!');
      console.log('Please set RAPID_API_KEY in your .env file');
      process.exit(1);
    }

    console.log('Testing API connection...');
    const test = await this.api.testConnection();
    if (!test.success) {
      console.error(`ERROR: API connection failed: ${test.message}`);
      process.exit(1);
    }
    console.log('SUCCESS: API connection established\n');

    await this.showMatches();
  }

  async showMatches() {
    try {
      console.log('Available Matches:\n');
      const matches = await this.api.getMatches();

      if (matches.length === 0) {
        console.log('No matches found');
        return;
      }

      matches.forEach((match, index) => {
        console.log(`${index + 1}. ${match.team1} vs ${match.team2}`);
        console.log(`   ${match.format} | ${match.status}`);
        console.log(`   ${match.series}`);
        console.log('');
      });

      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question('Select match number (or 0 to refresh, d for debug): ', async (answer) => {
        readline.close();
        
        if (answer.toLowerCase() === 'd') {
          this.api.setDebug(true);
          console.log('Debug mode enabled');
          setTimeout(() => this.showMatches(), 1000);
          return;
        }
        
        // Check if it's a debug command with match number (e.g., "d1" for debug match 1)
        if (answer.toLowerCase().startsWith('d') && answer.length > 1) {
          const debugSelection = parseInt(answer.substring(1));
          if (debugSelection > 0 && debugSelection <= matches.length) {
            const debugMatch = matches[debugSelection - 1];
            console.log(`\nDEBUGGING match: ${debugMatch.team1} vs ${debugMatch.team2}`);
            await this.api.debugScore(debugMatch.id);
            console.log('\nPress Enter to continue...');
            const readline2 = require('readline').createInterface({
              input: process.stdin,
              output: process.stdout
            });
            readline2.question('', () => {
              readline2.close();
              this.showMatches();
            });
            return;
          }
        }
        
        const selection = parseInt(answer);
        
        if (selection === 0) {
          console.clear();
          return this.showMatches();
        }
        
        if (selection > 0 && selection <= matches.length) {
          this.selectedMatch = matches[selection - 1];
          console.log(`\nSELECTED: ${this.selectedMatch.team1} vs ${this.selectedMatch.team2}\n`);
          await this.showLiveScore();
        } else {
          console.log('Invalid selection');
          setTimeout(() => this.showMatches(), 1000);
        }
      });

    } catch (error) {
      console.error('ERROR: Failed to fetch matches:', error.message);
      process.exit(1);
    }
  }

  async showLiveScore() {
    if (!this.selectedMatch) {
      return this.showMatches();
    }

    try {
      const scoreData = await this.api.getScore(this.selectedMatch.id);
      
      console.clear();
      console.log('Live Cricket Score');
      console.log('Press Ctrl+C to exit, or wait for auto-refresh...\n');
      
      console.log(this.api.formatScore(scoreData));
      
      console.log(`\nLast updated: ${new Date().toLocaleTimeString()}`);
      console.log('Refreshing in 30 seconds...\n');

      setTimeout(() => {
        this.showLiveScore();
      }, 30000);

    } catch (error) {
      console.error('ERROR: Failed to fetch score:', error.message);
      console.log('Retrying in 10 seconds...');
      setTimeout(() => this.showLiveScore(), 10000);
    }
  }
}

// Export for use in other modules
module.exports = {
  CricketScoreAPI,
  CricketCLI
};

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new CricketCLI();
  
  process.on('SIGINT', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });
  
  cli.start().catch(console.error);
}