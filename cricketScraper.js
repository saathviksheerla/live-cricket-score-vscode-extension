// cricketScraper.js - Core scraping module
const axios = require('axios');
const cheerio = require('cheerio');

class CricketScraper {
    constructor() {
        this.baseUrl = 'https://www.espncricinfo.com/live-cricket-score';
        this.matches = [];
    }

    async fetchLiveMatches() {
        try {
            const response = await axios.get(this.baseUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            this.matches = [];

            const scriptTag = $('script#__NEXT_DATA__').html();
            if (scriptTag) {
                const jsonData = JSON.parse(scriptTag);
                const matches = jsonData?.props?.appPageProps?.data?.content?.matches || [];
                
                matches.forEach((match, index) => {
                    this.matches.push({
                        id: index + 1,
                        matchId: match.objectId,
                        title: match.title,
                        series: match.series.name,
                        status: match.status,
                        statusText: match.statusText,
                        teams: match.teams.map(team => ({
                            name: team.team.name,
                            longName: team.team.longName,
                            score: team.score,
                            scoreInfo: team.scoreInfo,
                            isLive: team.isLive
                        })),
                        ground: match.ground?.smallName || 'TBD',
                        format: match.format,
                        startTime: match.startTime,
                        state: match.state,
                        liveOvers: match.liveOvers,
                        isLive: match.state === 'LIVE',
                        priority: this.calculatePriority(match)
                    });
                });

                this.matches.sort((a, b) => b.priority - a.priority);
            }

            return this.matches;
        } catch (error) {
            throw new Error(`Failed to fetch matches: ${error.message}`);
        }
    }

    calculatePriority(match) {
        let priority = 0;
        
        if (match.state === 'LIVE') priority += 100;
        
        const popularTeams = ['India', 'Pakistan', 'Australia', 'England', 'South Africa', 'New Zealand', 'Sri Lanka', 'West Indies', 'Bangladesh', 'Afghanistan'];
        const teamNames = match.teams.map(t => t.team.longName);
        
        popularTeams.forEach(popularTeam => {
            if (teamNames.some(name => name.includes(popularTeam))) {
                priority += 50;
            }
        });

        if (match.internationalClassId) priority += 25;
        if (match.state === 'POST') priority += 10;

        return priority;
    }

    getMatchById(id) {
        return this.matches.find(match => match.id === parseInt(id));
    }

    getMatches() {
        return this.matches;
    }
}

module.exports = CricketScraper;