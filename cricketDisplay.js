// cricketDisplay.js - Display formatting module
class CricketDisplay {
    static formatMatchList(matches) {
        if (matches.length === 0) {
            return 'No matches found at the moment.\n';
        }

        let output = '=== LIVE CRICKET MATCHES ===\n\n';
        
        matches.forEach((match) => {
            const statusIcon = match.isLive ? 'LIVE' : 
                              match.state === 'POST' ? 'RESULT' : 
                              'SCHEDULED';
            
            output += `${match.id}. [${statusIcon}]\n`;
            output += `   ${match.series}\n`;
            output += `   ${match.title}\n`;
            
            if (match.teams.length >= 2) {
                const team1 = match.teams[0];
                const team2 = match.teams[1];
                
                output += `   ${team1.longName}: ${team1.score || 'TBD'} ${team1.scoreInfo || ''}\n`;
                output += `   ${team2.longName}: ${team2.score || 'TBD'} ${team2.scoreInfo || ''}\n`;
            }
            
            if (match.statusText) {
                output += `   Status: ${match.statusText}\n`;
            }
            
            output += `   Ground: ${match.ground}\n`;
            output += '---\n';
        });

        return output;
    }

    static formatMatchDetails(match) {
        if (!match) {
            return 'Match not found.\n';
        }

        let output = '\n=== MATCH DETAILS ===\n\n';
        output += `Match: ${match.title}\n`;
        output += `Series: ${match.series}\n`;
        output += `Format: ${match.format}\n`;
        output += `Ground: ${match.ground}\n`;
        output += `Status: ${match.status}\n`;
        
        if (match.startTime) {
            const startTime = new Date(match.startTime);
            output += `Start Time: ${startTime.toLocaleString()}\n`;
        }
        
        output += '\n--- TEAMS & SCORES ---\n';
        
        match.teams.forEach(team => {
            const liveIndicator = team.isLive ? ' (Batting)' : '';
            output += `${team.longName}${liveIndicator}\n`;
            
            if (team.score) {
                output += `  Score: ${team.score}\n`;
            }
            
            if (team.scoreInfo) {
                output += `  Details: ${team.scoreInfo}\n`;
            }
            
            output += '\n';
        });

        if (match.liveOvers && match.isLive) {
            output += `Current Overs: ${match.liveOvers}\n`;
        }

        if (match.statusText) {
            output += `Match Status: ${match.statusText}\n`;
        }
        
        output += '\n======================\n\n';
        
        return output;
    }
}

module.exports = CricketDisplay;