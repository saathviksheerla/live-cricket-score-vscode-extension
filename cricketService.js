// cricketService.js - Service layer with auto-refresh
const EventEmitter = require('events');

class CricketService extends EventEmitter {
    constructor(scraper) {
        super();
        this.scraper = scraper;
        this.selectedMatchId = null;
        this.refreshInterval = null;
        this.refreshRate = 40000 + ( Math.floor(Math.random() * (60000 - (-10000) + 1)) + (-10000) ); // 40 seconds
        this.isRunning = false;
    }

    async initialize() {
        try {
            await this.scraper.fetchLiveMatches();
            this.emit('matchesUpdated', this.scraper.getMatches());
            return true;
        } catch (error) {
            this.emit('error', error);
            return false;
        }
    }

    selectMatch(matchId) {
        const match = this.scraper.getMatchById(matchId);
        if (!match) {
            return false;
        }

        this.selectedMatchId = matchId;
        this.startAutoRefresh();
        this.emit('matchSelected', match);
        return true;
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.isRunning = true;

        this.refreshInterval = setInterval(async () => {
            try {
                await this.scraper.fetchLiveMatches();
                const selectedMatch = this.scraper.getMatchById(this.selectedMatchId);
                
                if (selectedMatch) {
                    this.emit('matchUpdated', selectedMatch);
                } else {
                    this.emit('error', new Error('Selected match no longer available'));
                }
            } catch (error) {
                this.emit('error', error);
            }
        }, this.refreshRate);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            this.isRunning = false;
        }
    }

    changeMatch(matchId) {
        this.stopAutoRefresh();
        return this.selectMatch(matchId);
    }

    getSelectedMatch() {
        if (!this.selectedMatchId) return null;
        return this.scraper.getMatchById(this.selectedMatchId);
    }

    getAllMatches() {
        return this.scraper.getMatches();
    }

    setRefreshRate(seconds) {
        this.refreshRate = seconds * 1000;
        if (this.isRunning) {
            this.startAutoRefresh(); // Restart with new rate
        }
    }
}

module.exports = CricketService;